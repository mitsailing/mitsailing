import { describe, expect, it } from 'vitest';
import {
  emptyPavilionReservationPriceMap,
  PAVILION_RESERVATION_PERSONAS,
  parsePavilionReservationPersona,
} from '@/libs/mit-sailing/pavilionReservationPersonas';

describe('PAVILION_RESERVATION_PERSONAS', () => {
  it('parses known persona strings', () => {
    for (const persona of PAVILION_RESERVATION_PERSONAS) {
      expect(parsePavilionReservationPersona(persona)).toBe(persona);
    }
  });

  it('rejects unknown persona strings', () => {
    expect(parsePavilionReservationPersona('guest')).toBeUndefined();
  });
});

describe('emptyPavilionReservationPriceMap', () => {
  it('nulls every persona key', () => {
    const prices = emptyPavilionReservationPriceMap();
    for (const persona of PAVILION_RESERVATION_PERSONAS) {
      expect(prices[persona]).toBeNull();
    }
  });
});
