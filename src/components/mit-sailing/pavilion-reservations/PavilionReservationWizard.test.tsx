import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PavilionReservationWizard } from '@/components/mit-sailing/pavilion-reservations/PavilionReservationWizard';
import type {
  PavilionReservableItemDto,
  PavilionReservationSubmitState,
} from '@/libs/mit-sailing/pavilionReservationTypes';

vi.mock('@/libs/mit-sailing/pavilionReservationDraftActions', () => ({
  loadPavilionReservationDraftByResumeTokenAction: vi
    .fn()
    .mockResolvedValue(null),
}));

const space: PavilionReservableItemDto = {
  id: 'space-1',
  slug: 'casual_dock',
  kind: 'space',
  name: 'Casual dock',
  description: 'A dock reservation.',
  imageUrl: null,
  pricingType: 'hourly',
  minDurationHours: null,
  publicGroup: 'venue',
  displayOrder: 1,
  media: [],
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
  publicGroup: null,
  displayOrder: 2,
  media: [],
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
  action?: (
    state: PavilionReservationSubmitState,
    formData: FormData
  ) => Promise<PavilionReservationSubmitState>;
  blockedRanges?: {
    itemId: string;
    date: string;
    startMinutes: number;
    endMinutes: number;
  }[];
  items?: PavilionReservableItemDto[];
  serverResume?: {
    draft: {
      contact: {
        firstName: string;
        lastName: string;
        phone: string;
        eventName: string;
        groupName: string;
        groupSize: string;
        description: string;
        hasTent: boolean;
        servesAlcohol: boolean;
        projectTitle: string;
        advisorName: string;
        advisorEmail: string;
        costCenter: string;
        mitId: string;
        mitAccount: string;
      };
      persona: 'mit_student';
      requesterEmail: string;
      selectedServiceIds: string[];
      slots: [];
      step: 'contact' | 'spaces';
    };
    requestId: string;
    resumeToken: string;
  };
}) {
  return render(
    <PavilionReservationWizard
      action={props.action ?? mockSubmitAction}
      blockedRanges={props.blockedRanges ?? []}
      initialState={{ status: 'idle', errors: [] }}
      items={props.items ?? [space]}
      permalink="/reserve"
      serverResume={props.serverResume ?? null}
      upsertDraft={async () => {
        await Promise.resolve();
        return { ok: false };
      }}
    />
  );
}

function slotsInput(container: HTMLElement) {
  const input = container.querySelector('input[name="slots"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError('Expected slots input.');
  }
  return input;
}

function hiddenInput(container: HTMLElement, name: string) {
  const input = container.querySelector(`input[name="${name}"]`);
  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError(`Expected ${name} input.`);
  }
  return input;
}

function selectCompletedSlot() {
  fireEvent.click(screen.getByRole('button', { name: 'Select this option' }));
  fireEvent.click(screen.getByRole('button', { name: '20' }));
  fireEvent.click(screen.getByRole('button', { name: '9:00 AM' }));
  fireEvent.click(screen.getByRole('button', { name: '10:00 AM' }));
}

function parsedSlots(container: HTMLElement): unknown {
  const slots: unknown = JSON.parse(slotsInput(container).value);
  return slots;
}

function selectedTimeButton(name: string) {
  const button = screen
    .getAllByRole('button', { name })
    .find((element) => element.getAttribute('aria-pressed') === 'true');
  if (!button) {
    throw new Error(`Expected selected time button ${name}.`);
  }
  return button;
}

const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'scrollIntoView'
);

describe('PavilionReservationWizard slot picker', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
    });
    Element.prototype.scrollIntoView = vi.fn();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T16:00:00.000Z'));
  });

  afterEach(() => {
    if (originalScrollIntoViewDescriptor) {
      Object.defineProperty(
        Element.prototype,
        'scrollIntoView',
        originalScrollIntoViewDescriptor
      );
    } else {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    }
    globalThis.sessionStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('exposes two public stages', () => {
    renderWizard({});

    expect(screen.getByText('Spaces & dates')).toBeInTheDocument();
    expect(screen.getByText('Contact & summary')).toBeInTheDocument();
    expect(screen.queryByText('Review')).toBeNull();
  });

  it('writes selected calendar and time grid values', () => {
    const { container } = renderWizard({});

    selectCompletedSlot();

    expect(parsedSlots(container)).toEqual([
      {
        itemId: 'space-1',
        date: '2026-05-20',
        startMinutes: 540,
        endMinutes: 600,
      },
    ]);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duplicate' })).toBeNull();
    expect(screen.queryByRole('button', { name: '11:00 AM' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getAllByText('Select start time').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: 'Change date' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done editing' })).toBeNull();
    expect(
      screen.getByRole('button', { name: '20', pressed: true })
    ).toBeInTheDocument();
    expect(selectedTimeButton('9:00 AM')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '10:00 AM' })
    ).toBeInTheDocument();
    expect(parsedSlots(container)).toEqual([
      {
        itemId: 'space-1',
        date: '2026-05-20',
        startMinutes: 540,
        endMinutes: 600,
      },
    ]);
  });

  it('updates end time after reconfirming start like cal.com booker advance', () => {
    const { container } = renderWizard({});

    selectCompletedSlot();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: '9:00 AM' }));
    fireEvent.click(screen.getByRole('button', { name: '11:00 AM' }));

    expect(parsedSlots(container)).toEqual([
      {
        itemId: 'space-1',
        date: '2026-05-20',
        startMinutes: 540,
        endMinutes: 660,
      },
    ]);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '9:00 AM' })).toBeNull();
  });

  it('clears end time when the start time changes', () => {
    const { container } = renderWizard({});

    selectCompletedSlot();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: '9:30 AM' }));

    expect(parsedSlots(container)).toEqual([
      {
        itemId: 'space-1',
        date: '2026-05-20',
        startMinutes: 570,
        endMinutes: 0,
      },
    ]);
    expect(screen.getAllByText('Select end time').length).toBeGreaterThan(0);
    expect(screen.getByText('Starts at 9:30 AM')).toBeInTheDocument();
  });

  it('preserves valid times when changing the date then reconfirming start', () => {
    const { container } = renderWizard({});

    selectCompletedSlot();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: '22' }));

    expect(parsedSlots(container)).toEqual([
      {
        itemId: 'space-1',
        date: '2026-05-22',
        startMinutes: 540,
        endMinutes: 600,
      },
    ]);
    expect(selectedTimeButton('9:00 AM')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '10:00 AM' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '9:00 AM' }));
    expect(selectedTimeButton('10:00 AM')).toBeInTheDocument();
  });

  it('clears invalid end time when changing to a conflicting date', () => {
    const { container } = renderWizard({
      blockedRanges: [
        {
          itemId: 'space-1',
          date: '2026-05-21',
          startMinutes: 570,
          endMinutes: 630,
        },
      ],
    });

    selectCompletedSlot();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: '21' }));

    expect(parsedSlots(container)).toEqual([
      {
        itemId: 'space-1',
        date: '2026-05-21',
        startMinutes: 540,
        endMinutes: 0,
      },
    ]);
    expect(selectedTimeButton('9:00 AM')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '10:00 AM' })).toBeNull();
  });

  it('writes selected guided calendar and time grid values', () => {
    const { container } = renderWizard({});

    fireEvent.click(screen.getByRole('button', { name: 'Select this option' }));
    fireEvent.click(screen.getByRole('button', { name: '20' }));
    expect(screen.queryByText('Morning')).toBeNull();
    expect(screen.queryByText('Afternoon')).toBeNull();
    expect(screen.queryByText('Evening')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '9:00 AM' }));
    expect(
      screen.getByRole('button', { name: 'Change start' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '10:00 AM' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '10:00 AM' }));

    expect(parsedSlots(container)).toEqual([
      {
        itemId: 'space-1',
        date: '2026-05-20',
        startMinutes: 540,
        endMinutes: 600,
      },
    ]);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '11:00 AM' })).toBeNull();
  });

  it('lets you remove an accidentally selected option before finishing times', () => {
    const { container } = renderWizard({});

    fireEvent.click(screen.getByRole('button', { name: 'Select this option' }));

    expect(screen.getByText('Selected')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit time' })).toBeNull();

    const [removeOption] = screen.getAllByRole('button', {
      name: 'Remove option',
    });
    if (!removeOption) {
      throw new Error('Expected Remove option button.');
    }
    fireEvent.click(removeOption);

    expect(parsedSlots(container)).toEqual([]);
    expect(
      screen.getByRole('button', { name: 'Select this option' })
    ).toBeInTheDocument();
  });

  it('restores an in-progress draft from server resume seed', () => {
    renderWizard({
      serverResume: {
        requestId: 'draft-1',
        resumeToken: 'resume-token-abc',
        draft: {
          step: 'spaces',
          persona: 'mit_student',
          requesterEmail: 'draft@mit.edu',
          slots: [],
          selectedServiceIds: [],
          contact: {
            firstName: '',
            lastName: '',
            phone: '',
            eventName: '',
            groupName: '',
            groupSize: '',
            description: '',
            hasTent: false,
            servesAlcohol: false,
            projectTitle: '',
            advisorName: '',
            advisorEmail: '',
            costCenter: '',
            mitId: '',
            mitAccount: '',
          },
        },
      },
    });

    expect(
      screen.getByText('We restored your in-progress request on this device.')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email address*')).toHaveValue(
      'draft@mit.edu'
    );
    expect(screen.getByRole('radio', { name: /MIT Student/u })).toBeChecked();
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

  it('shows spaces validation above the inline actions', () => {
    const { container } = renderWizard({});

    expect(
      screen.getByRole('button', { name: 'Next: contact information' })
    ).toBeDisabled();
    expect(
      screen.getByText('Enter a valid email address to continue.')
    ).toBeInTheDocument();
    expect(container.querySelector('.fixed.inset-x-0.bottom-0')).toBeNull();
  });

  it('prioritizes first-step fix targets', () => {
    renderWizard({});
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    fireEvent.click(screen.getByRole('button', { name: 'Fix this' }));

    expect(screen.getByLabelText('Email address*')).toHaveFocus();

    fireEvent.change(screen.getByLabelText('Email address*'), {
      target: { value: 'sailor@example.edu' },
    });

    expect(
      screen.getByText('Select an option to continue.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select this option' }));

    expect(
      screen.getByText('Finish the selected date and time to continue.')
    ).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('keeps malformed email on the first step', () => {
    renderWizard({});

    fireEvent.change(screen.getByLabelText('Email address*'), {
      target: { value: 'sailor@' },
    });
    selectCompletedSlot();

    expect(
      screen.getByText('Enter a valid email address to continue.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Next: contact information' })
    ).toBeDisabled();
    expect(screen.getByLabelText('Email address*')).toHaveValue('sailor@');
  });

  it('shows submit pending state on final submit', async () => {
    const deferred = Promise.withResolvers<PavilionReservationSubmitState>();
    const action = vi.fn(async () => {
      const state = await deferred.promise;
      return state;
    });
    renderWizard({ action });

    fireEvent.change(screen.getByLabelText('Email address*'), {
      target: { value: 'sailor@example.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select this option' }));
    fireEvent.click(screen.getByRole('button', { name: '20' }));
    fireEvent.click(screen.getByRole('button', { name: '9:00 AM' }));
    fireEvent.click(screen.getByRole('button', { name: '10:00 AM' }));
    vi.useRealTimers();
    fireEvent.click(
      screen.getByRole('button', { name: 'Next: contact information' })
    );
    fireEvent.change(screen.getByLabelText('First name*'), {
      target: { value: 'Avery' },
    });
    fireEvent.change(screen.getByLabelText('Last name*'), {
      target: { value: 'Sailor' },
    });
    fireEvent.change(screen.getByLabelText('Phone*'), {
      target: { value: '617-555-0100' },
    });
    fireEvent.change(screen.getByLabelText('Event name*'), {
      target: { value: 'Dock talk' },
    });
    fireEvent.change(screen.getByLabelText('Event description*'), {
      target: { value: 'A short academic waterfront event.' },
    });
    fireEvent.change(screen.getByLabelText('Project title*'), {
      target: { value: 'Hydrodynamics' },
    });
    fireEvent.change(screen.getByLabelText('Faculty advisor name*'), {
      target: { value: 'Taylor Advisor' },
    });
    fireEvent.change(screen.getByLabelText('Faculty advisor email*'), {
      target: { value: 'advisor@example.edu' },
    });
    fireEvent.change(screen.getByLabelText('Cost center*'), {
      target: { value: '1234567' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit reservation request' })
    );

    expect(
      await screen.findByRole('button', { name: 'Submitting...' })
    ).toBeInTheDocument();
    deferred.resolve({ status: 'idle', errors: [] });
  });

  it('shows confirmation after successful final submit', async () => {
    const action = vi.fn(async () => {
      const state: PavilionReservationSubmitState = await Promise.resolve({
        status: 'confirmed',
        referenceCode: 'PAV-TEST123',
        errors: [],
      });
      return state;
    });
    renderWizard({ action });

    fireEvent.change(screen.getByLabelText('Email address*'), {
      target: { value: 'sailor@example.edu' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /MIT Student/u }));
    selectCompletedSlot();
    vi.useRealTimers();
    fireEvent.click(
      screen.getByRole('button', { name: 'Next: contact information' })
    );
    fireEvent.change(screen.getByLabelText('First name*'), {
      target: { value: 'Avery' },
    });
    fireEvent.change(screen.getByLabelText('Last name*'), {
      target: { value: 'Sailor' },
    });
    fireEvent.change(screen.getByLabelText('Phone*'), {
      target: { value: '617-555-0100' },
    });
    fireEvent.change(screen.getByLabelText('Event name*'), {
      target: { value: 'Dock Talk' },
    });
    fireEvent.change(screen.getByLabelText('Event description*'), {
      target: { value: 'A short waterfront event.' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit reservation request' })
    );

    expect(
      await screen.findByRole('heading', { name: 'Request received' })
    ).toBeInTheDocument();
    expect(screen.getByText('PAV-TEST123')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Submitting...' })
    ).not.toBeInTheDocument();
  });

  it('clears unavailable services when group type changes on contact', () => {
    const { container } = renderWizard({ items: [space, service] });

    fireEvent.change(screen.getByLabelText('Email address*'), {
      target: { value: 'sailor@example.edu' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /MIT Student/u }));
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
    expect(screen.getByLabelText('MIT affiliation type*')).toHaveValue(
      'mit_student'
    );
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

  it('changes MIT affiliation type from the affiliation section', () => {
    const { container } = renderWizard({ items: [space, service] });

    fireEvent.change(screen.getByLabelText('Email address*'), {
      target: { value: 'sailor@example.edu' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /MIT Student/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Select this option' }));
    fireEvent.click(screen.getByRole('button', { name: '20' }));
    fireEvent.click(screen.getByRole('button', { name: '9:00 AM' }));
    fireEvent.click(screen.getByRole('button', { name: '10:00 AM' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Next: contact information' })
    );

    fireEvent.change(screen.getByLabelText('MIT affiliation type*'), {
      target: { value: 'mit_community' },
    });

    expect(screen.getByLabelText('Group type*')).toHaveValue('mit_community');
    expect(hiddenInput(container, 'persona').value).toBe('mit_community');
  });

  it('marks contact required fields aria-invalid until each is filled', () => {
    renderWizard({});

    fireEvent.change(screen.getByLabelText('Email address*'), {
      target: { value: 'sailor@example.edu' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /MIT Student/u }));
    selectCompletedSlot();
    fireEvent.click(
      screen.getByRole('button', { name: 'Next: contact information' })
    );

    const firstName = screen.getByLabelText('First name*');
    const lastName = screen.getByLabelText('Last name*');

    expect(firstName).not.toHaveAttribute('aria-invalid', 'true');

    fireEvent.click(
      screen.getByRole('button', { name: 'Submit reservation request' })
    );

    expect(firstName).toHaveAttribute('aria-invalid', 'true');
    expect(lastName).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText(
        'Fill out the required contact fields before continuing.'
      )
    ).toBeInTheDocument();

    fireEvent.change(firstName, { target: { value: 'Avery' } });

    expect(firstName).not.toHaveAttribute('aria-invalid', 'true');
    expect(lastName).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText(
        'Fill out the required contact fields before continuing.'
      )
    ).toBeInTheDocument();
  });
});
