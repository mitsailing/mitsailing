import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const {
  eventRegistrationErrorMessage,
  eventRegistrationErrorMessageKey,
  parseEventRegistrationMutationCode,
} = await import('@/libs/mit-sailing/eventRegistrationErrors');

describe('parseEventRegistrationMutationCode', () => {
  it('returns known code unchanged', () => {
    expect(parseEventRegistrationMutationCode('answers_invalid')).toBe(
      'answers_invalid'
    );
    expect(parseEventRegistrationMutationCode('closed')).toBe('closed');
    expect(parseEventRegistrationMutationCode('full')).toBe('full');
    expect(parseEventRegistrationMutationCode('not_found')).toBe('not_found');
    expect(parseEventRegistrationMutationCode('questions_required')).toBe(
      'questions_required'
    );
    expect(parseEventRegistrationMutationCode('swim_agreement_required')).toBe(
      'swim_agreement_required'
    );
    expect(parseEventRegistrationMutationCode('unknown')).toBe('unknown');
  });

  it('returns null for unknown strings', () => {
    expect(parseEventRegistrationMutationCode('bogus')).toBeNull();
    expect(parseEventRegistrationMutationCode('')).toBeNull();
  });

  it('returns null for nullish input', () => {
    expect(parseEventRegistrationMutationCode(null)).toBeNull();
    expect(parseEventRegistrationMutationCode()).toBeNull();
  });
});

describe('eventRegistrationErrorMessageKey', () => {
  it('maps each known code to its translation key', () => {
    expect(eventRegistrationErrorMessageKey('closed')).toBe(
      'registration_error_closed'
    );
    expect(eventRegistrationErrorMessageKey('full')).toBe(
      'registration_error_full'
    );
    expect(eventRegistrationErrorMessageKey('questions_required')).toBe(
      'registration_error_questions_required'
    );
    expect(eventRegistrationErrorMessageKey('answers_invalid')).toBe(
      'registration_error_answers_invalid'
    );
    expect(eventRegistrationErrorMessageKey('swim_agreement_required')).toBe(
      'registration_error_swim_agreement_required'
    );
    expect(eventRegistrationErrorMessageKey('not_found')).toBe(
      'registration_error_not_found'
    );
    expect(eventRegistrationErrorMessageKey('unknown')).toBe(
      'registration_error_unknown'
    );
  });

  it('returns null for unrecognized codes and nullish values', () => {
    expect(eventRegistrationErrorMessageKey('bogus')).toBeNull();
    expect(eventRegistrationErrorMessageKey('')).toBeNull();
    expect(eventRegistrationErrorMessageKey(null)).toBeNull();
    expect(eventRegistrationErrorMessageKey()).toBeNull();
  });
});

describe('eventRegistrationErrorMessage', () => {
  it('invokes the translator with the resolved key and returns the translation', () => {
    const t = vi.fn((key: string) => `tr:${key}`);
    expect(eventRegistrationErrorMessage('closed', t)).toBe(
      'tr:registration_error_closed'
    );
    expect(t).toHaveBeenCalledWith('registration_error_closed');
  });

  it('returns null without calling the translator for unknown codes', () => {
    const t = vi.fn((key: string) => `tr:${key}`);
    expect(eventRegistrationErrorMessage('bogus', t)).toBeNull();
    expect(eventRegistrationErrorMessage(null, t)).toBeNull();
    expect(eventRegistrationErrorMessage(undefined, t)).toBeNull();
    expect(t).not.toHaveBeenCalled();
  });
});
