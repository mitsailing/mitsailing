import { SailingAffiliation } from '@/generated/prisma/enums';
import type messages from '@/locales/en.json';

type MitIdMode = 'required' | 'optional' | 'hidden';
type ManualNameMode = 'forbidden' | 'optional' | 'required';

type SailingAffiliationRule = {
  readonly value: SailingAffiliation;
  readonly translationKey: string;
  readonly mitIdMode: MitIdMode;
  readonly allowManualName: boolean;
  readonly manualNameMode: ManualNameMode;
};

const sailingAffiliationRules = [
  {
    value: SailingAffiliation.MIT_STUDENT,
    translationKey: 'affiliations.mit_student',
    mitIdMode: 'required',
    allowManualName: false,
    manualNameMode: 'forbidden',
  },
  {
    value: SailingAffiliation.MIT_FACULTY,
    translationKey: 'affiliations.mit_faculty',
    mitIdMode: 'required',
    allowManualName: false,
    manualNameMode: 'forbidden',
  },
  {
    value: SailingAffiliation.MIT_STAFF,
    translationKey: 'affiliations.mit_staff',
    mitIdMode: 'required',
    allowManualName: false,
    manualNameMode: 'forbidden',
  },
  {
    value: SailingAffiliation.MIT_ALUM,
    translationKey: 'affiliations.mit_alum',
    mitIdMode: 'optional',
    allowManualName: true,
    manualNameMode: 'optional',
  },
  {
    value: SailingAffiliation.MIT_FAMILY,
    translationKey: 'affiliations.mit_family',
    mitIdMode: 'optional',
    allowManualName: true,
    manualNameMode: 'optional',
  },
  {
    value: SailingAffiliation.MIT_AFFILIATE,
    translationKey: 'affiliations.mit_affiliate',
    mitIdMode: 'optional',
    allowManualName: true,
    manualNameMode: 'optional',
  },
  {
    value: SailingAffiliation.WELLESLEY,
    translationKey: 'affiliations.wellesley',
    mitIdMode: 'hidden',
    allowManualName: true,
    manualNameMode: 'required',
  },
  {
    value: SailingAffiliation.BRANDEIS,
    translationKey: 'affiliations.brandeis',
    mitIdMode: 'hidden',
    allowManualName: true,
    manualNameMode: 'required',
  },
  {
    value: SailingAffiliation.NORTHEASTERN,
    translationKey: 'affiliations.northeastern',
    mitIdMode: 'hidden',
    allowManualName: true,
    manualNameMode: 'required',
  },
  {
    value: SailingAffiliation.WINSOR,
    translationKey: 'affiliations.winsor',
    mitIdMode: 'hidden',
    allowManualName: true,
    manualNameMode: 'required',
  },
  {
    value: SailingAffiliation.BROOKS,
    translationKey: 'affiliations.brooks',
    mitIdMode: 'hidden',
    allowManualName: true,
    manualNameMode: 'required',
  },
  {
    value: SailingAffiliation.NROTC,
    translationKey: 'affiliations.nrotc',
    mitIdMode: 'hidden',
    allowManualName: true,
    manualNameMode: 'required',
  },
  {
    value: SailingAffiliation.OTHER_STUDENT,
    translationKey: 'affiliations.other_student',
    mitIdMode: 'hidden',
    allowManualName: true,
    manualNameMode: 'required',
  },
  {
    value: SailingAffiliation.OTHER_NON_STUDENT,
    translationKey: 'affiliations.other_non_student',
    mitIdMode: 'hidden',
    allowManualName: true,
    manualNameMode: 'required',
  },
] as const satisfies readonly SailingAffiliationRule[];

const defaultSailingAffiliationRule: SailingAffiliationRule = {
  value: SailingAffiliation.NON_MIT,
  translationKey: 'affiliations.non_mit',
  mitIdMode: 'hidden',
  allowManualName: true,
  manualNameMode: 'required',
};

export const getSailingAffiliationOptions = () => sailingAffiliationRules;

export const getSailingAffiliationRule = (affiliation: SailingAffiliation) =>
  sailingAffiliationRules.find((rule) => rule.value === affiliation) ??
  defaultSailingAffiliationRule;

const sailingAffiliationLabelKeys = {
  [SailingAffiliation.MIT_STUDENT]: 'affiliation_mit_student',
  [SailingAffiliation.MIT_FACULTY]: 'affiliation_mit_faculty',
  [SailingAffiliation.MIT_STAFF]: 'affiliation_mit_staff',
  [SailingAffiliation.MIT_ALUM]: 'affiliation_mit_alum',
  [SailingAffiliation.MIT_FAMILY]: 'affiliation_mit_family',
  [SailingAffiliation.MIT_AFFILIATE]: 'affiliation_mit_affiliate',
  [SailingAffiliation.WELLESLEY]: 'affiliation_wellesley',
  [SailingAffiliation.BRANDEIS]: 'affiliation_brandeis',
  [SailingAffiliation.NORTHEASTERN]: 'affiliation_northeastern',
  [SailingAffiliation.WINSOR]: 'affiliation_winsor',
  [SailingAffiliation.BROOKS]: 'affiliation_brooks',
  [SailingAffiliation.NROTC]: 'affiliation_nrotc',
  [SailingAffiliation.OTHER_STUDENT]: 'affiliation_other_student',
  [SailingAffiliation.OTHER_NON_STUDENT]: 'affiliation_other_non_student',
  [SailingAffiliation.NON_MIT]: 'affiliation_non_mit',
} as const satisfies Record<
  SailingAffiliation,
  keyof typeof messages.OnboardingPage
>;

/**
 * Returns the OnboardingPage message key for a sailing affiliation.
 *
 * @param affiliation - Stored sailing affiliation
 * @returns next-intl message key
 */
export function sailingAffiliationLabelKey(affiliation: SailingAffiliation) {
  return sailingAffiliationLabelKeys[affiliation];
}

export const isMitIdAsked = (affiliation: SailingAffiliation) =>
  getSailingAffiliationRule(affiliation).mitIdMode !== 'hidden';

export const isMitIdRequired = (affiliation: SailingAffiliation) =>
  getSailingAffiliationRule(affiliation).mitIdMode === 'required';

export const isManualNameAllowed = (affiliation: SailingAffiliation) =>
  getSailingAffiliationRule(affiliation).allowManualName;
