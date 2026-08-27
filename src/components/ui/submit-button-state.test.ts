import { describe, expect, it } from 'vitest';
import {
  isSubmitButtonPending,
  joinDescribedByIds,
  resolveSubmitPendingLabel,
  submitButtonChromeProps,
} from '@/components/ui/submit-button-state';

const saveAction = async () => {};
const sendAction = async () => {};

describe('isSubmitButtonPending', () => {
  it('uses explicit pending prop when provided', () => {
    expect(
      isSubmitButtonPending({
        formAction: undefined,
        formPending: false,
        formStatusAction: null,
        pendingProp: true,
        submitTimedOut: false,
      })
    ).toBe(true);
  });

  it('returns false when the form is not pending', () => {
    expect(
      isSubmitButtonPending({
        formAction: undefined,
        formPending: false,
        formStatusAction: null,
        pendingProp: undefined,
        submitTimedOut: false,
      })
    ).toBe(false);
  });

  it('returns false after submit timeout', () => {
    expect(
      isSubmitButtonPending({
        formAction: undefined,
        formPending: true,
        formStatusAction: null,
        pendingProp: undefined,
        submitTimedOut: true,
      })
    ).toBe(false);
  });

  it('matches only the active formAction when set', () => {
    expect(
      isSubmitButtonPending({
        formAction: saveAction,
        formPending: true,
        formStatusAction: sendAction,
        pendingProp: undefined,
        submitTimedOut: false,
      })
    ).toBe(false);
    expect(
      isSubmitButtonPending({
        formAction: sendAction,
        formPending: true,
        formStatusAction: sendAction,
        pendingProp: undefined,
        submitTimedOut: false,
      })
    ).toBe(true);
  });
});

describe('resolveSubmitPendingLabel', () => {
  it('prefers an explicit pending label', () => {
    expect(
      resolveSubmitPendingLabel({
        pendingKind: 'saving',
        pendingLabel: 'Saving draft...',
        translate: () => 'pending_saving',
      })
    ).toBe('Saving draft...');
  });

  it('translates pendingKind when no label is provided', () => {
    expect(
      resolveSubmitPendingLabel({
        pendingKind: 'sending',
        pendingLabel: undefined,
        translate: (key) => key,
      })
    ).toBe('pending_sending');
  });
});

describe('joinDescribedByIds', () => {
  it('returns undefined for empty ids', () => {
    expect(joinDescribedByIds()).toBeUndefined();
  });

  it('joins present ids', () => {
    expect(joinDescribedByIds('a', undefined, 'b')).toBe('a b');
  });
});

describe('submitButtonChromeProps', () => {
  it('applies pending chrome', () => {
    expect(
      submitButtonChromeProps({
        disabled: false,
        isPending: true,
        pendingDescriptionId: 'pending-desc',
        pendingLabel: 'Saving...',
        propsAriaDescribedBy: 'hint',
        title: 'Save',
        type: undefined,
      })
    ).toEqual({
      'aria-busy': true,
      'aria-describedby': 'hint pending-desc',
      disabled: true,
      title: 'Saving...',
      type: 'submit',
    });
  });

  it('preserves idle chrome', () => {
    expect(
      submitButtonChromeProps({
        disabled: true,
        isPending: false,
        pendingDescriptionId: 'pending-desc',
        pendingLabel: 'Saving...',
        propsAriaDescribedBy: 'hint',
        title: 'Save',
        type: 'button',
      })
    ).toEqual({
      'aria-busy': undefined,
      'aria-describedby': 'hint',
      disabled: true,
      title: 'Save',
      type: 'button',
    });
  });
});
