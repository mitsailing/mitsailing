import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PavilionReservationWizard } from '@/components/mit-sailing/pavilion-reservations/PavilionReservationWizard';
import type {
  PavilionReservableItemDto,
  PavilionReservationSubmitState,
} from '@/libs/mit-sailing/pavilionReservationTypes';

const space: PavilionReservableItemDto = {
  id: 'space-1',
  slug: 'casual_dock',
  kind: 'space',
  name: 'Casual dock',
  description: 'A dock reservation.',
  imageUrl: null,
  pricingType: 'hourly',
  minDurationHours: null,
  displayOrder: 1,
  prices: {
    mit_academic: 10_000,
    mit_student: 10_000,
    mit_community: 10_000,
    non_mit: 10_000,
  },
};

const service: PavilionReservableItemDto = {
  id: 'service-1',
  slug: 'extra_tables',
  kind: 'service',
  name: 'Extra tables',
  description: 'Additional event tables.',
  imageUrl: null,
  pricingType: 'flat',
  minDurationHours: null,
  displayOrder: 2,
  prices: {
    mit_academic: 5000,
    mit_student: 5000,
    mit_community: 5000,
    non_mit: null,
  },
};

async function mockSubmitAction(): Promise<PavilionReservationSubmitState> {
  const state: PavilionReservationSubmitState = await Promise.resolve({
    status: 'idle',
    errors: [],
  });
  return state;
}

function renderWizard(props: {
  blockedRanges?: {
    itemId: string;
    date: string;
    startMinutes: number;
    endMinutes: number;
  }[];
  items?: PavilionReservableItemDto[];
}) {
  return render(
    <PavilionReservationWizard
      action={mockSubmitAction}
      blockedRanges={props.blockedRanges ?? []}
      initialState={{ status: 'idle', errors: [] }}
      items={props.items ?? [space]}
      permalink="/reserve-pavilion"
    />
  );
}

function slotsInput(container: HTMLElement) {
  const input = container.querySelector('input[name="slots"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Expected slots input.');
  }
  return input;
}

function hiddenInput(container: HTMLElement, name: string) {
  const input = container.querySelector(`input[name="${name}"]`);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Expected ${name} input.`);
  }
  return input;
}

describe('PavilionReservationWizard slot picker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T16:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes two public stages', () => {
    renderWizard({});

    expect(screen.getByText('Spaces & dates')).toBeInTheDocument();
    expect(screen.getByText('Contact & summary')).toBeInTheDocument();
    expect(screen.queryByText('Review')).toBeNull();
  });

  it('writes selected calendar and time grid values', () => {
    const { container } = renderWizard({});

    fireEvent.click(screen.getByRole('button', { name: 'Select this option' }));
    fireEvent.click(screen.getByRole('button', { name: '20' }));
    fireEvent.click(screen.getByRole('button', { name: '9:00 AM' }));
    expect(
      screen.getAllByRole('button', { name: 'Change start' })[0]
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '10:00 AM' }));

    expect(JSON.parse(slotsInput(container).value)).toEqual([
      {
        itemId: 'space-1',
        date: '2026-05-20',
        startMinutes: 540,
        endMinutes: 600,
      },
    ]);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '11:00 AM' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(
      screen.getByRole('button', { name: 'Change date' })
    ).toBeInTheDocument();
  });

  it('disables blocked and under-notice start times', () => {
    renderWizard({
      blockedRanges: [
        {
          itemId: 'space-1',
          date: '2026-05-20',
          startMinutes: 9 * 60,
          endMinutes: 10 * 60,
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select this option' }));
    fireEvent.click(screen.getByRole('button', { name: '17' }));

    expect(screen.queryByRole('button', { name: '9:00 AM' })).toBeNull();
    expect(screen.getByRole('button', { name: '12:00 PM' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Change date' }));
    fireEvent.click(screen.getByRole('button', { name: '20' }));

    expect(screen.queryByRole('button', { name: '9:00 AM' })).toBeNull();
    expect(screen.getByRole('button', { name: '10:00 AM' })).toBeEnabled();
  });

  it('shows spaces validation in the fixed footer', () => {
    const { container } = renderWizard({});

    fireEvent.click(
      screen.getByRole('button', { name: 'Next: contact information' })
    );

    expect(screen.getByText('Email address is required.')).toBeInTheDocument();
    expect(
      screen.getByText('Select at least one option before continuing.')
    ).toBeInTheDocument();
    expect(container.querySelector('.fixed.inset-x-0.bottom-0')).not.toBeNull();
  });

  it('clears unavailable services when group type changes on contact', () => {
    const { container } = renderWizard({ items: [space, service] });

    fireEvent.change(screen.getByLabelText('Email address*'), {
      target: { value: 'sailor@example.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select this option' }));
    fireEvent.click(screen.getByRole('button', { name: '20' }));
    fireEvent.click(screen.getByRole('button', { name: '9:00 AM' }));
    fireEvent.click(screen.getByRole('button', { name: '10:00 AM' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Next: contact information' })
    );

    expect(screen.getByLabelText('Email address*')).toHaveValue(
      'sailor@example.edu'
    );
    expect(screen.getByLabelText('Group type*')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Review your reservation' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Review your request' })
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Submit reservation request' })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('First name*'), {
      target: { value: 'Avery' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /Extra tables/u }));

    expect(JSON.parse(hiddenInput(container, 'services').value)).toEqual([
      'service-1',
    ]);

    fireEvent.change(screen.getByLabelText('Group type*'), {
      target: { value: 'non_mit' },
    });

    expect(JSON.parse(hiddenInput(container, 'services').value)).toEqual([]);
    expect(hiddenInput(container, 'requesterEmail').value).toBe(
      'sailor@example.edu'
    );
    expect(hiddenInput(container, 'firstName').value).toBe('Avery');
    expect(JSON.parse(slotsInput(container).value)).toEqual([
      {
        itemId: 'space-1',
        date: '2026-05-20',
        startMinutes: 540,
        endMinutes: 600,
      },
    ]);
  });
});
