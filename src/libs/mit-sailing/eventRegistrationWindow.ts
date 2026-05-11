/**
 * Shared registration window checks for public standard events. Keeps the
 * detail-page state machine and server actions aligned on boundary instants.
 *
 * **Time model:** Each bound is a single instant. Per
 * [MDN `Date`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date),
 * that instant is stored as UTC epoch milliseconds; relational checks use
 * `.getTime()` so ordering matches that numeric model (same values Prisma returns
 * for `DateTime`). For new greenfield APIs MDN recommends `Temporal`; this
 * module stays on `Date` for Prisma round-trips and server `Date` clocks.
 *
 * **Start:** `before_start` while `now < registrationStart` when a start exists.
 * **End:** `after_end` when `now >= registrationEnd` when an end exists — the
 * deadline instant is not open (half-open interval `[start, end)`).
 */

/** Where `now` sits relative to optional registration window bounds. */
export type PublicRegistrationWindowPhase =
  | 'before_start'
  | 'after_end'
  | 'open';

/**
 * Resolves `now` against optional registration bounds for UI and server guards.
 *
 * @param options - Comparison instant and optional Prisma `DateTime` bounds
 * @returns Phase used by `isPublicEventRegistration*` wrappers
 */
export function publicRegistrationWindowPhase(options: {
  now: Date;
  registrationStart: Date | null;
  registrationEnd: Date | null;
}): PublicRegistrationWindowPhase {
  const nowMs = options.now.getTime();
  const start = options.registrationStart;
  if (start !== null && nowMs < start.getTime()) {
    return 'before_start';
  }
  const end = options.registrationEnd;
  if (end !== null && nowMs >= end.getTime()) {
    return 'after_end';
  }
  return 'open';
}

export function isPublicEventRegistrationBeforeWindow(options: {
  now: Date;
  registrationStart: Date | null;
}): boolean {
  return (
    publicRegistrationWindowPhase({
      now: options.now,
      registrationStart: options.registrationStart,
      registrationEnd: null,
    }) === 'before_start'
  );
}

export function isPublicEventRegistrationAfterWindow(options: {
  now: Date;
  registrationEnd: Date | null;
}): boolean {
  return (
    publicRegistrationWindowPhase({
      now: options.now,
      registrationStart: null,
      registrationEnd: options.registrationEnd,
    }) === 'after_end'
  );
}

export function isPublicEventRegistrationWindowOpen(options: {
  now: Date;
  registrationStart: Date | null;
  registrationEnd: Date | null;
}): boolean {
  return publicRegistrationWindowPhase(options) === 'open';
}
