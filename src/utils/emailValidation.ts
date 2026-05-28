/**
 * Stricter than HTML `type="email"`: requires a domain with a dot and a TLD-like
 * final label (at least two characters). Rejects single-label domains such as `a@b`.
 *
 * @param raw - Candidate email string from user input
 * @returns True when the address has a plausible public domain (dot + TLD segment)
 */
export function isValidMarketingEmail(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return false;
  }
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) {
    return false;
  }
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (local.length === 0 || domain.length === 0) {
    return false;
  }
  if (!domain.includes('.')) {
    return false;
  }
  const segments = domain.split('.');
  if (segments.some((s) => s.length === 0)) {
    return false;
  }
  const publicSuffix = segments.at(-1);
  return publicSuffix !== undefined && publicSuffix.length >= 2;
}
