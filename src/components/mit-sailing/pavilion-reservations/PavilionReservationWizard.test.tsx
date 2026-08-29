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

const grill: PavilionReservableItemDto = {
  id: 'grill-1',
  slug: 'grill',
  kind: 'space',
  name: 'Barbecue grill',
  description: 'Flat grill fee.',
  imageUrl: null,
  pricingType: 'flat',
  minDurationHours: null,
  publicGroup: 'venue',
  displayOrder: 2,
  media: [],
  prices: {
    mit_academic: 3000,
    mit_student: 3000,
    mit_community: 3000,
    non_mit: 3000,
  },
};

const after10: PavilionReservableItemDto = {
  id: 'after-10',
  slug: 'after_10',
  kind: 'space',
  name: 'After close through 10:00 PM',
  description: '',
  imageUrl: null,
  pricingType: 'flat',
  minDurationHours: null,
  publicGroup: 'event_options',
  displayOrder: 50,
  media: [],
  prices: {
    mit_academic: null,
    mit_student: 32_500,
    mit_community: 41_000,
    non_mit: 57_500,
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
      step: 'identity' | 'request' | 'review' | 'contact' | 'spaces';
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
      items={props.items ?? [space, grill, after10]}
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

function goToRequestStep() {
  fireEvent.change(screen.getByLabelText('Email address*'), {
    target: { value: 'sailor@example.edu' },
  });
  fireEvent.click(screen.getByRole('button', { name: /MIT Student/u }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Continue to your request' })
  );
}

function selectCompletedSlot() {
  fireEvent.click(screen.getByRole('button', { name: 'Select this option' }));
  fireEvent.click(screen.getByRole('button', { name: '20' }));
  fireEvent.click(screen.getByRole('button', { name: 'Morning' }));
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

describe('PavilionReservationWizard reserve redesign', () => {
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

  it('exposes three public stages', () => {
    renderWizard({});

    expect(screen.getAllByText('Email and group type').length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText('Your request').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Review and submit').length).toBeGreaterThan(0);
  });

  it('requires email before continuing to the request step', () => {
    renderWizard({});

    expect(
      screen.getByRole('button', { name: 'Continue to your request' })
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Email address*'), {
      target: { value: 'sailor@example.edu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /MIT Student/u }));

    expect(
      screen.getByRole('button', { name: 'Continue to your request' })
    ).toBeEnabled();
  });

  it('writes selected calendar and time grid values with start bands', () => {
    const { container } = renderWizard({});
    goToRequestStep();
    selectCompletedSlot();

    expect(parsedSlots(container)).toEqual(
      expect.arrayContaining([
        {
          itemId: 'space-1',
          date: '2026-05-20',
          startMinutes: 540,
          endMinutes: 600,
        },
      ])
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('groups start times behind morning afternoon evening', () => {
    renderWizard({});
    goToRequestStep();
    fireEvent.click(screen.getByRole('button', { name: 'Select this option' }));
    fireEvent.click(screen.getByRole('button', { name: '20' }));

    expect(screen.getByRole('button', { name: 'Morning' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Afternoon' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Evening' })).toBeInTheDocument();
  });

  it('lets grill-only continue without a venue calendar', () => {
    renderWizard({});
    goToRequestStep();

    fireEvent.click(screen.getByRole('checkbox', { name: /Barbecue grill/u }));

    expect(
      screen.getAllByRole('button', {
        name: 'Continue to review and submit',
      })[0]
    ).toBeEnabled();
  });

  it('keeps after-hours catalog items out of the builder list', () => {
    renderWizard({});
    goToRequestStep();

    expect(
      screen.queryByRole('checkbox', { name: /After close through 10:00 PM/u })
    ).toBeNull();
    expect(screen.getByText('Cancellation and FAQ')).toBeInTheDocument();
    expect(
      screen.getByText('What if I just want to grill?')
    ).toBeInTheDocument();
  });

  it('updates end time after reconfirming start like cal.com booker advance', () => {
    const { container } = renderWizard({});
    goToRequestStep();
    selectCompletedSlot();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Morning' }));
    fireEvent.click(screen.getByRole('button', { name: '9:00 AM' }));
    fireEvent.click(screen.getByRole('button', { name: '11:00 AM' }));

    expect(parsedSlots(container)).toEqual(
      expect.arrayContaining([
        {
          itemId: 'space-1',
          date: '2026-05-20',
          startMinutes: 540,
          endMinutes: 660,
        },
      ])
    );
  });

  it('clears end time when the start time changes', () => {
    const { container } = renderWizard({});
    goToRequestStep();
    selectCompletedSlot();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Morning' }));
    fireEvent.click(screen.getByRole('button', { name: '9:30 AM' }));

    expect(parsedSlots(container)).toEqual(
      expect.arrayContaining([
        {
          itemId: 'space-1',
          date: '2026-05-20',
          startMinutes: 570,
          endMinutes: 0,
        },
      ])
    );
    expect(screen.getAllByText('Select end time').length).toBeGreaterThan(0);
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
    expect(
      screen.getByRole('button', { name: 'Continue to review and submit' })
    ).toBeInTheDocument();
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

    goToRequestStep();
    selectCompletedSlot();
    vi.useRealTimers();
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Continue to review and submit',
      })[0]!
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
  });

  it('marks contact required fields aria-invalid until each is filled', () => {
    renderWizard({});
    goToRequestStep();
    selectCompletedSlot();
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Continue to review and submit',
      })[0]!
    );

    const firstName = screen.getByLabelText('First name*');
    const lastName = screen.getByLabelText('Last name*');

    fireEvent.click(
      screen.getByRole('button', { name: 'Submit reservation request' })
    );

    expect(firstName).toHaveAttribute('aria-invalid', 'true');
    expect(lastName).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(firstName, { target: { value: 'Avery' } });

    expect(firstName).not.toHaveAttribute('aria-invalid', 'true');
    expect(lastName).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps selected time buttons pressed after edit opens', () => {
    renderWizard({});
    goToRequestStep();
    selectCompletedSlot();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Morning' }));

    expect(selectedTimeButton('9:00 AM')).toBeInTheDocument();
  });
});
