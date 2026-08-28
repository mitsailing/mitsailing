const PAVILION_RESERVATION_RESUME_TOKEN_SESSION_KEY =
  'pavilion-reservation-resume-token';

/**
 * Reads the stored resume token for same-tab pavilion wizard recovery.
 *
 * @returns Stored resume token or null when missing
 */
export function readPavilionReservationResumeTokenFromSession(): string | null {
  if (globalThis.sessionStorage === undefined) {
    return null;
  }
  const token = globalThis.sessionStorage.getItem(
    PAVILION_RESERVATION_RESUME_TOKEN_SESSION_KEY
  );
  return token?.trim() ? token.trim() : null;
}

/**
 * Persists the resume token after the first successful server draft save.
 *
 * @param resumeToken - Opaque resume token from the server
 */
export function writePavilionReservationResumeTokenToSession(
  resumeToken: string
): void {
  if (globalThis.sessionStorage === undefined) {
    return;
  }
  const trimmed = resumeToken.trim();
  if (!trimmed) {
    return;
  }
  globalThis.sessionStorage.setItem(
    PAVILION_RESERVATION_RESUME_TOKEN_SESSION_KEY,
    trimmed
  );
}

/**
 * Clears the session resume token after a confirmed submit.
 */
export function clearPavilionReservationResumeTokenFromSession(): void {
  if (globalThis.sessionStorage === undefined) {
    return;
  }
  globalThis.sessionStorage.removeItem(
    PAVILION_RESERVATION_RESUME_TOKEN_SESSION_KEY
  );
}
