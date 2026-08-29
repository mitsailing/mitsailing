/**
 * Reads a thrown auth-client value as a non-empty Error message.
 *
 * @param error - Unknown catch value from an auth client call
 * @returns Trimmed message, or undefined when the throw was not a named Error
 */
export function authClientThrownMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const message = error.message.trim();
  return message === '' ? undefined : message;
}
