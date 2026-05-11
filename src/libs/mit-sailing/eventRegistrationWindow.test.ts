import { describe, expect, it } from 'vitest';
import {
  isPublicEventRegistrationAfterWindow,
  isPublicEventRegistrationBeforeWindow,
  isPublicEventRegistrationWindowOpen,
  publicRegistrationWindowPhase,
} from '@/libs/mit-sailing/eventRegistrationWindow';

const start = new Date('2026-06-01T12:00:00.000Z');
const end = new Date('2026-06-30T12:00:00.000Z');

describe('publicRegistrationWindowPhase', () => {
  it('returns after_end at registration end instant when end is set', () => {
    expect(
      publicRegistrationWindowPhase({
        now: end,
        registrationStart: start,
        registrationEnd: end,
      })
    ).toBe('after_end');
  });

  it('returns open at registration start instant', () => {
    expect(
      publicRegistrationWindowPhase({
        now: start,
        registrationStart: start,
        registrationEnd: end,
      })
    ).toBe('open');
  });

  it('returns before_start when only start is relevant', () => {
    expect(
      publicRegistrationWindowPhase({
        now: new Date('2026-05-15T12:00:00.000Z'),
        registrationStart: start,
        registrationEnd: end,
      })
    ).toBe('before_start');
  });

  it('returns after_end when now is strictly after registration end', () => {
    expect(
      publicRegistrationWindowPhase({
        now: new Date('2026-07-01T12:00:00.000Z'),
        registrationStart: start,
        registrationEnd: end,
      })
    ).toBe('after_end');
  });

  it('returns open strictly inside window', () => {
    expect(
      publicRegistrationWindowPhase({
        now: new Date('2026-06-15T12:00:00.000Z'),
        registrationStart: start,
        registrationEnd: end,
      })
    ).toBe('open');
  });
});

describe('isPublicEventRegistrationBeforeWindow', () => {
  it('returns true when now is strictly before registration start', () => {
    expect(
      isPublicEventRegistrationBeforeWindow({
        now: new Date('2026-05-31T12:00:00.000Z'),
        registrationStart: start,
      })
    ).toBe(true);
  });

  it('returns false at the registration start instant', () => {
    expect(
      isPublicEventRegistrationBeforeWindow({
        now: start,
        registrationStart: start,
      })
    ).toBe(false);
  });

  it('returns false when registration start is unset', () => {
    expect(
      isPublicEventRegistrationBeforeWindow({
        now: new Date('2026-01-01T00:00:00.000Z'),
        registrationStart: null,
      })
    ).toBe(false);
  });
});

describe('isPublicEventRegistrationAfterWindow', () => {
  it('returns true when now is strictly after registration end', () => {
    expect(
      isPublicEventRegistrationAfterWindow({
        now: new Date('2026-07-01T12:00:00.000Z'),
        registrationEnd: end,
      })
    ).toBe(true);
  });

  it('returns true at the registration end instant', () => {
    expect(
      isPublicEventRegistrationAfterWindow({
        now: end,
        registrationEnd: end,
      })
    ).toBe(true);
  });

  it('returns false when now is strictly before registration end', () => {
    expect(
      isPublicEventRegistrationAfterWindow({
        now: new Date('2026-06-29T12:00:00.000Z'),
        registrationEnd: end,
      })
    ).toBe(false);
  });

  it('returns false when registration end is unset', () => {
    expect(
      isPublicEventRegistrationAfterWindow({
        now: new Date('2099-01-01T00:00:00.000Z'),
        registrationEnd: null,
      })
    ).toBe(false);
  });
});

describe('isPublicEventRegistrationWindowOpen', () => {
  it('returns false at registration end when start and end are set', () => {
    expect(
      isPublicEventRegistrationWindowOpen({
        now: end,
        registrationStart: start,
        registrationEnd: end,
      })
    ).toBe(false);
  });

  it('returns true strictly inside the window', () => {
    expect(
      isPublicEventRegistrationWindowOpen({
        now: new Date('2026-06-15T12:00:00.000Z'),
        registrationStart: start,
        registrationEnd: end,
      })
    ).toBe(true);
  });

  it('returns true when both bounds are unset', () => {
    expect(
      isPublicEventRegistrationWindowOpen({
        now: new Date('2026-06-15T12:00:00.000Z'),
        registrationStart: null,
        registrationEnd: null,
      })
    ).toBe(true);
  });
});
