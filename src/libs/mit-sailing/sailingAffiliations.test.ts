import { describe, expect, it } from 'vitest';
import { SailingAffiliation } from '@/generated/prisma/enums';
import {
  getSailingAffiliationOptions,
  getSailingAffiliationRule,
  isManualNameAllowed,
  isMitIdAsked,
  isMitIdRequired,
} from '@/libs/mit-sailing/sailingAffiliations';

describe('sailingAffiliations', () => {
  it('includes every legacy affiliation plus the internal fallback', () => {
    expect(Object.values(SailingAffiliation)).toEqual([
      'MIT_STUDENT',
      'MIT_FACULTY',
      'MIT_STAFF',
      'MIT_ALUM',
      'MIT_FAMILY',
      'MIT_AFFILIATE',
      'WELLESLEY',
      'BRANDEIS',
      'NORTHEASTERN',
      'WINSOR',
      'BROOKS',
      'NROTC',
      'OTHER_STUDENT',
      'OTHER_NON_STUDENT',
      'NON_MIT',
    ]);
  });

  it('requires mit id for current mit people', () => {
    expect(isMitIdRequired(SailingAffiliation.MIT_STUDENT)).toBe(true);
    expect(isMitIdRequired(SailingAffiliation.MIT_FACULTY)).toBe(true);
    expect(isMitIdRequired(SailingAffiliation.MIT_STAFF)).toBe(true);
    expect(isManualNameAllowed(SailingAffiliation.MIT_STUDENT)).toBe(false);
    expect(isManualNameAllowed(SailingAffiliation.MIT_FACULTY)).toBe(false);
    expect(isManualNameAllowed(SailingAffiliation.MIT_STAFF)).toBe(false);
    expect(
      getSailingAffiliationRule(SailingAffiliation.MIT_STUDENT).manualNameMode
    ).toBe('forbidden');
    expect(
      getSailingAffiliationRule(SailingAffiliation.MIT_FACULTY).manualNameMode
    ).toBe('forbidden');
    expect(
      getSailingAffiliationRule(SailingAffiliation.MIT_STAFF).manualNameMode
    ).toBe('forbidden');
  });

  it('allows optional mit id and manual names for mit community affiliations', () => {
    for (const affiliation of [
      SailingAffiliation.MIT_ALUM,
      SailingAffiliation.MIT_FAMILY,
      SailingAffiliation.MIT_AFFILIATE,
    ]) {
      expect(isMitIdAsked(affiliation)).toBe(true);
      expect(isMitIdRequired(affiliation)).toBe(false);
      expect(isManualNameAllowed(affiliation)).toBe(true);
      expect(getSailingAffiliationRule(affiliation).manualNameMode).toBe(
        'optional'
      );
    }
  });

  it('requires manual names without mit id for school and other affiliations', () => {
    for (const affiliation of [
      SailingAffiliation.WELLESLEY,
      SailingAffiliation.BRANDEIS,
      SailingAffiliation.NORTHEASTERN,
      SailingAffiliation.WINSOR,
      SailingAffiliation.BROOKS,
      SailingAffiliation.NROTC,
      SailingAffiliation.OTHER_STUDENT,
      SailingAffiliation.OTHER_NON_STUDENT,
    ]) {
      expect(isMitIdAsked(affiliation)).toBe(false);
      expect(isMitIdRequired(affiliation)).toBe(false);
      expect(isManualNameAllowed(affiliation)).toBe(true);
      expect(getSailingAffiliationRule(affiliation).manualNameMode).toBe(
        'required'
      );
    }
  });

  it('keeps non mit as an internal fallback only', () => {
    expect(isMitIdAsked(SailingAffiliation.NON_MIT)).toBe(false);
    expect(isMitIdRequired(SailingAffiliation.NON_MIT)).toBe(false);
    expect(isManualNameAllowed(SailingAffiliation.NON_MIT)).toBe(true);
    expect(
      getSailingAffiliationOptions().map((option) => option.value)
    ).not.toContain(SailingAffiliation.NON_MIT);
  });

  it('returns visible options in legacy dropdown order', () => {
    expect(
      getSailingAffiliationOptions().map((option) => option.value)
    ).toEqual([
      SailingAffiliation.MIT_STUDENT,
      SailingAffiliation.MIT_FACULTY,
      SailingAffiliation.MIT_STAFF,
      SailingAffiliation.MIT_ALUM,
      SailingAffiliation.MIT_FAMILY,
      SailingAffiliation.MIT_AFFILIATE,
      SailingAffiliation.WELLESLEY,
      SailingAffiliation.BRANDEIS,
      SailingAffiliation.NORTHEASTERN,
      SailingAffiliation.WINSOR,
      SailingAffiliation.BROOKS,
      SailingAffiliation.NROTC,
      SailingAffiliation.OTHER_STUDENT,
      SailingAffiliation.OTHER_NON_STUDENT,
    ]);
  });

  it('returns rule metadata by affiliation', () => {
    expect(
      getSailingAffiliationRule(SailingAffiliation.MIT_STUDENT).mitIdMode
    ).toBe('required');
  });
});
