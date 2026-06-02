import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as ReactModule from 'react';
import { expect, vi } from 'vitest';
import { SailingAffiliation } from '@/generated/prisma/enums';
import type {
  SailingCardOnboardingFormState,
  SailingCardOnboardingFormValues,
} from '@/libs/mit-sailing/sailingCardOnboardingActions';
import { SailingCardOnboardingDraftProvider } from './SailingCardOnboardingDraftProvider';
import { SailingCardOnboardingForm } from './SailingCardOnboardingForm';
import type { SailingCardOnboardingLockedIdentity } from './SailingCardOnboardingFormTypes';

type RenderFormProps = {
  readonly callbackUrl?: string;
  readonly draftKey?: string;
  readonly hasVerifiedMitRecreationMembership?: boolean;
  readonly initialMembershipCheckoutUrl?: string | null;
  readonly initialValues?: SailingCardOnboardingFormValues;
  readonly lockedIdentity?: SailingCardOnboardingLockedIdentity;
};

export const emptyValues = {
  affiliation: '',
  cardType: 'normal',
  dateOfBirth: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  firstName: '',
  hasFitnessMembership: '',
  lastName: '',
  mitId: '',
  phone: '',
  swimAgreementAccepted: false,
} satisfies SailingCardOnboardingFormValues;

const actionStateMock = vi.hoisted(() => ({
  formAction: vi.fn(),
  routerPush: vi.fn(),
  state: {
    fieldErrors: {},
    status: 'idle',
    values: {
      affiliation: '',
      cardType: 'normal',
      dateOfBirth: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      firstName: '',
      hasFitnessMembership: '',
      lastName: '',
      mitId: '',
      phone: '',
      swimAgreementAccepted: false,
    },
  } as SailingCardOnboardingFormState,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useActionState: vi.fn(() => [
      actionStateMock.state,
      actionStateMock.formAction,
    ]),
  };
});

vi.mock('next-intl', async () => {
  const { useOnboardingTestTranslations } =
    await import('./SailingCardOnboardingForm.testIntl');

  return {
    useTranslations: useOnboardingTestTranslations,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: actionStateMock.routerPush,
  }),
}));

vi.mock('@/libs/mit-sailing/sailingCardOnboardingActions', () => ({
  submitSailingCardOnboardingAction: vi.fn(),
}));

export function resetOnboardingFormTestState() {
  vi.clearAllMocks();
  globalThis.sessionStorage.clear();
  globalThis.history.replaceState(null, '', '/');
  actionStateMock.state = {
    fieldErrors: {},
    status: 'idle',
    values: emptyValues,
  };
}

export function setOnboardingFormActionState(
  state: SailingCardOnboardingFormState
) {
  actionStateMock.state = state;
}

export function renderForm(props: RenderFormProps = {}) {
  return render(
    <SailingCardOnboardingDraftProvider>
      <SailingCardOnboardingForm
        callbackUrl={props.callbackUrl}
        draftKey={props.draftKey}
        hasVerifiedMitRecreationMembership={
          props.hasVerifiedMitRecreationMembership
        }
        initialMembershipCheckoutUrl={props.initialMembershipCheckoutUrl}
        initialValues={props.initialValues}
        lockedIdentity={props.lockedIdentity}
      />
    </SailingCardOnboardingDraftProvider>
  );
}

function PersistentDraftFormHarness(
  props: RenderFormProps & {
    readonly visible: boolean;
  }
) {
  return (
    <SailingCardOnboardingDraftProvider>
      {props.visible ? (
        <SailingCardOnboardingForm
          callbackUrl={props.callbackUrl}
          draftKey={props.draftKey}
          hasVerifiedMitRecreationMembership={
            props.hasVerifiedMitRecreationMembership
          }
          initialValues={props.initialValues}
          lockedIdentity={props.lockedIdentity}
        />
      ) : null}
    </SailingCardOnboardingDraftProvider>
  );
}

export function renderFormWithPersistentDraftProvider(
  props: RenderFormProps = {}
) {
  const result = render(<PersistentDraftFormHarness {...props} visible />);

  return {
    ...result,
    remount: () => {
      result.rerender(
        <PersistentDraftFormHarness {...props} visible={false} />
      );
      result.rerender(<PersistentDraftFormHarness {...props} visible />);
    },
  };
}

export const selectAffiliation = async (affiliation: SailingAffiliation) => {
  const user = userEvent.setup();

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Affiliation' }),
    affiliation
  );
};

export const showWellesleyDetails = async () => {
  const user = userEvent.setup();

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Affiliation' }),
    SailingAffiliation.WELLESLEY
  );
  await user.type(screen.getByLabelText('First name'), 'Grace');
  await user.type(screen.getByLabelText('Last name'), 'Hopper');
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  return user;
};

export const expectDetailsHidden = () => {
  expect(
    screen.queryByRole('heading', { name: 'Contact and safety' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('group', { name: 'Type of sailing card requested' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText(
      'I have read and agree to the swim agreement and liability release.'
    )
  ).not.toBeInTheDocument();
};

export const submittedFormData = () => {
  const formData = actionStateMock.formAction.mock.calls[0]?.[0];

  if (!(formData instanceof FormData)) {
    throw new TypeError('Expected onboarding submit to send FormData.');
  }

  return formData;
};
