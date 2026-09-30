import * as z from 'zod';
import { wholeDollarsCentsOrNullFromForm } from '@/libs/admin/catalog/pavilionSpacesSchemas';
import type { CatalogRow } from '@/libs/admin/catalog/types';
import { PAVILION_RESERVATION_PERSONAS } from '@/libs/mit-sailing/pavilionReservationPersonas';
import type { PavilionReservationPersonaValue } from '@/libs/mit-sailing/pavilionReservationPersonas';

const PAVILION_RATE_SHEET_GROUPS = [
  'venue',
  'event_options',
  'programs',
  'services',
] as const;

export type PavilionRateSheetGroupId =
  (typeof PAVILION_RATE_SHEET_GROUPS)[number];

export type PavilionRateDraft = {
  amounts: Record<PavilionReservationPersonaValue, string>;
  group: PavilionRateSheetGroupId;
  id: string;
  isVisible: boolean;
  minDurationHours: string;
  name: string;
  pricingType: 'hourly' | 'flat';
};

export type PavilionRateSheetError = {
  code: 'hourly_min_duration' | 'save_failed' | 'whole_dollars';
  field: 'form' | 'minDurationHours' | PavilionReservationPersonaValue;
  id: string;
};

export type PavilionRateSheetSaveRow = {
  id: string;
  minDurationHours: number | null;
  pricesCents: Record<PavilionReservationPersonaValue, number | null>;
  pricingType: 'hourly' | 'flat';
};

export type PavilionRateSheetActionState = {
  errors: PavilionRateSheetError[];
  status: 'idle' | 'saved' | 'error';
};

export const pavilionRateSheetIdleState: PavilionRateSheetActionState = {
  errors: [],
  status: 'idle',
};

const pavilionRateAmountSchema = z.object({
  mit_academic: z.string(),
  mit_community: z.string(),
  mit_student: z.string(),
  non_mit: z.string(),
});

const pavilionRateSheetPayloadSchema = z.object({
  rows: z.array(
    z.object({
      amounts: pavilionRateAmountSchema,
      id: z.string().trim().min(1),
      minDurationHours: z.string(),
      pricingType: z.enum(['hourly', 'flat']),
    })
  ),
});

function catalogText(row: CatalogRow, field: string): string {
  const value = row[field];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function groupForCatalogRow(row: CatalogRow): PavilionRateSheetGroupId {
  if (row.kind === 'service') {
    return 'services';
  }
  if (
    row.publicGroup === 'venue' ||
    row.publicGroup === 'event_options' ||
    row.publicGroup === 'programs'
  ) {
    return row.publicGroup;
  }
  return 'programs';
}

function emptyAmounts(): Record<PavilionReservationPersonaValue, string> {
  return {
    mit_academic: '',
    mit_community: '',
    mit_student: '',
    non_mit: '',
  };
}

/**
 * Maps catalog list rows into editable rate-sheet drafts.
 *
 * @param rows - Pavilion spaces catalog rows
 * @returns Drafts in the incoming list order
 */
export function pavilionRateDraftsFromCatalogRows(
  rows: readonly CatalogRow[]
): PavilionRateDraft[] {
  const drafts: PavilionRateDraft[] = [];
  for (const row of rows) {
    if (typeof row.id !== 'string' || row.id.length === 0) {
      continue;
    }
    if (typeof row.name !== 'string' || row.name.trim().length === 0) {
      continue;
    }
    const amounts = emptyAmounts();
    amounts.mit_academic = catalogText(row, 'priceMitAcademic');
    amounts.mit_student = catalogText(row, 'priceMitStudent');
    amounts.mit_community = catalogText(row, 'priceMitCommunity');
    amounts.non_mit = catalogText(row, 'priceNonMit');
    drafts.push({
      amounts,
      group: groupForCatalogRow(row),
      id: row.id,
      isVisible: row.isVisible !== false,
      minDurationHours: catalogText(row, 'minDurationHours'),
      name: row.name,
      pricingType: row.pricingType === 'hourly' ? 'hourly' : 'flat',
    });
  }
  return drafts;
}

/**
 * Groups drafts in public-page order and drops empty groups.
 *
 * @param rows - Rate drafts
 * @returns Non-empty groups, venue first and services last
 */
export function groupPavilionRateDrafts(
  rows: readonly PavilionRateDraft[]
): { group: PavilionRateSheetGroupId; rows: PavilionRateDraft[] }[] {
  return PAVILION_RATE_SHEET_GROUPS.flatMap((group) => {
    const grouped = rows.filter((row) => row.group === group);
    return grouped.length > 0 ? [{ group, rows: grouped }] : [];
  });
}

/**
 * Copies the MIT academic amount onto the other audiences.
 *
 * @param amounts - Current audience amounts
 * @returns Amounts with every audience set to the academic value
 */
export function pricesMatchingFirstAudience(
  amounts: PavilionRateDraft['amounts']
): PavilionRateDraft['amounts'] {
  const source = amounts.mit_academic;
  return {
    mit_academic: source,
    mit_community: source,
    mit_student: source,
    non_mit: source,
  };
}

function dollarInputCents(raw: string): number | null | 'invalid' {
  const normalized = raw.replaceAll(/[$,\s]/g, '');
  if (normalized.length === 0) {
    return null;
  }
  const cents = wholeDollarsCentsOrNullFromForm(normalized);
  if (cents === null || Number.isNaN(cents)) {
    return 'invalid';
  }
  return cents;
}

function minimumHours(props: {
  minDurationHours: string;
  pricingType: 'hourly' | 'flat';
}): number | null | 'invalid' {
  if (props.pricingType === 'flat') {
    return null;
  }
  if (!/^[1-9]\d*$/u.test(props.minDurationHours.trim())) {
    return 'invalid';
  }
  return Number.parseInt(props.minDurationHours.trim(), 10);
}

/**
 * Validates a rate-sheet save payload.
 *
 * @param input - JSON body from the rates form
 * @returns Normalized rows, or field errors when a row cannot be saved
 */
export function parsePavilionRateSheetSave(
  input: unknown
):
  | { ok: true; rows: PavilionRateSheetSaveRow[] }
  | { ok: false; errors: PavilionRateSheetError[] } {
  const parsed = pavilionRateSheetPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: [{ id: '', field: 'form', code: 'save_failed' }],
    };
  }

  const errors: PavilionRateSheetError[] = [];
  const rows: PavilionRateSheetSaveRow[] = [];
  const seen = new Set<string>();

  for (const row of parsed.data.rows) {
    if (seen.has(row.id)) {
      errors.push({ id: row.id, field: 'form', code: 'save_failed' });
      continue;
    }
    seen.add(row.id);

    const minDurationHours = minimumHours(row);
    if (minDurationHours === 'invalid') {
      errors.push({
        id: row.id,
        field: 'minDurationHours',
        code: 'hourly_min_duration',
      });
    }

    const pricesCents = {
      mit_academic: null,
      mit_community: null,
      mit_student: null,
      non_mit: null,
    } as Record<PavilionReservationPersonaValue, number | null>;

    for (const persona of PAVILION_RESERVATION_PERSONAS) {
      const cents = dollarInputCents(row.amounts[persona]);
      if (cents === 'invalid') {
        errors.push({ id: row.id, field: persona, code: 'whole_dollars' });
        continue;
      }
      pricesCents[persona] = cents;
    }

    if (minDurationHours === 'invalid') {
      continue;
    }
    rows.push({
      id: row.id,
      minDurationHours,
      pricesCents,
      pricingType: row.pricingType,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, rows };
}
