import { AsYouType, parsePhoneNumberWithError } from 'libphonenumber-js';

type PhoneNormalizationResult = { ok: true; phone: string } | { ok: false };

function normalizePhone(
  raw: string,
  options: { requireCountry?: 'US' }
): PhoneNormalizationResult {
  let parsed = null;
  try {
    parsed = parsePhoneNumberWithError(raw, {
      defaultCountry: 'US',
      extract: false,
    });
  } catch {
    parsed = null;
  }
  if (!parsed?.isValid() || parsed.ext) {
    return { ok: false };
  }
  if (options.requireCountry && parsed.country !== options.requireCountry) {
    return { ok: false };
  }
  return { ok: true, phone: parsed.number };
}

export function normalizeUsPhone(raw: string): PhoneNormalizationResult {
  return normalizePhone(raw, { requireCountry: 'US' });
}

export function normalizeInternationalPhone(
  raw: string
): PhoneNormalizationResult {
  return normalizePhone(raw, {});
}

export function formatPhoneForDisplay(phone: string | null): string {
  if (!phone) {
    return '';
  }
  let parsed = null;
  try {
    parsed = parsePhoneNumberWithError(phone, {
      defaultCountry: 'US',
      extract: false,
    });
  } catch {
    parsed = null;
  }
  if (!parsed?.isValid()) {
    return phone;
  }
  return parsed.country === 'US'
    ? parsed.formatNational()
    : parsed.formatInternational();
}

export function formatPhoneAsYouType(value: string): string {
  return new AsYouType('US').input(value);
}
