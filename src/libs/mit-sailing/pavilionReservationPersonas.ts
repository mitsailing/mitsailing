/**
 * Pavilion reservation personas kept as a const tuple (not a Prisma enum) so
 * seed data, Zod forms, and legacy import paths share one runtime list.
 */
export const PAVILION_RESERVATION_PERSONAS = [
  'mit_academic',
  'mit_student',
  'mit_community',
  'non_mit',
] as const;

export type PavilionReservationPersonaValue =
  (typeof PAVILION_RESERVATION_PERSONAS)[number];

export type PavilionReservationPriceMap = Record<
  PavilionReservationPersonaValue,
  number | null
>;

export function emptyPavilionReservationPriceMap(): PavilionReservationPriceMap {
  return {
    mit_academic: null,
    mit_community: null,
    mit_student: null,
    non_mit: null,
  };
}

/**
 * @param value - Raw persona from form data or API
 * @returns Parsed persona when value is known
 */
export function parsePavilionReservationPersona(
  value: string
): PavilionReservationPersonaValue | undefined {
  return PAVILION_RESERVATION_PERSONAS.find((persona) => persona === value);
}
