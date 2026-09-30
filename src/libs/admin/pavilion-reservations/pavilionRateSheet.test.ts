import { describe, expect, it } from 'vitest';
import type { CatalogRow } from '@/libs/admin/catalog/types';
import {
  groupPavilionRateDrafts,
  parsePavilionRateSheetSave,
  pavilionRateDraftsFromCatalogRows,
  pricesMatchingFirstAudience,
} from '@/libs/admin/pavilion-reservations/pavilionRateSheet';

function catalogRow(
  props: Partial<CatalogRow> & { id: string; name: string }
): CatalogRow {
  return {
    isVisible: true,
    kind: 'space',
    minDurationHours: 1,
    priceMitAcademic: '',
    priceMitCommunity: '',
    priceMitStudent: '',
    priceNonMit: '',
    pricingType: 'hourly',
    publicGroup: 'venue',
    ...props,
  };
}

describe('pavilionRateSheet', () => {
  it('groups catalog rows into venue, event options, programs, then services', () => {
    const groups = groupPavilionRateDrafts(
      pavilionRateDraftsFromCatalogRows([
        catalogRow({
          id: 'lesson',
          kind: 'service',
          name: 'Group lesson',
          publicGroup: null,
        }),
        catalogRow({ id: 'roof', name: 'Roof deck', publicGroup: 'venue' }),
        catalogRow({ id: 'dock', name: 'Casual dock', publicGroup: 'venue' }),
        catalogRow({
          id: 'lab',
          name: 'Lab access',
          publicGroup: 'programs',
        }),
        catalogRow({
          id: 'after-10',
          name: 'After 10',
          publicGroup: 'event_options',
        }),
      ])
    );

    expect(
      groups.map((group) => ({
        group: group.group,
        names: group.rows.map((row) => row.name),
      }))
    ).toEqual([
      { group: 'venue', names: ['Roof deck', 'Casual dock'] },
      { group: 'event_options', names: ['After 10'] },
      { group: 'programs', names: ['Lab access'] },
      { group: 'services', names: ['Group lesson'] },
    ]);
  });

  it('parses on request, complimentary, currency text, and flat minimum hours', () => {
    const parsed = parsePavilionRateSheetSave({
      rows: [
        {
          amounts: {
            mit_academic: '',
            mit_community: '$1,200',
            mit_student: '0',
            non_mit: '10.6',
          },
          id: 'dock',
          minDurationHours: '2',
          pricingType: 'hourly',
        },
        {
          amounts: {
            mit_academic: '',
            mit_community: '',
            mit_student: '',
            non_mit: '',
          },
          id: 'grill',
          minDurationHours: '4',
          pricingType: 'flat',
        },
      ],
    });

    expect(parsed).toEqual({
      ok: true,
      rows: [
        {
          id: 'dock',
          minDurationHours: 2,
          pricesCents: {
            mit_academic: null,
            mit_community: 120_000,
            mit_student: 0,
            non_mit: 1100,
          },
          pricingType: 'hourly',
        },
        {
          id: 'grill',
          minDurationHours: null,
          pricesCents: {
            mit_academic: null,
            mit_community: null,
            mit_student: null,
            non_mit: null,
          },
          pricingType: 'flat',
        },
      ],
    });
  });

  it('rejects hourly rows without minimum hours and invalid dollar amounts', () => {
    const parsed = parsePavilionRateSheetSave({
      rows: [
        {
          amounts: {
            mit_academic: 'nope',
            mit_community: '',
            mit_student: '',
            non_mit: '',
          },
          id: 'dock',
          minDurationHours: '',
          pricingType: 'hourly',
        },
      ],
    });

    expect(parsed).toEqual({
      ok: false,
      errors: [
        {
          id: 'dock',
          field: 'minDurationHours',
          code: 'hourly_min_duration',
        },
        { id: 'dock', field: 'mit_academic', code: 'whole_dollars' },
      ],
    });
  });

  it('copies the academic amount to every audience', () => {
    expect(
      pricesMatchingFirstAudience({
        mit_academic: '320',
        mit_community: '',
        mit_student: '200',
        non_mit: '0',
      })
    ).toEqual({
      mit_academic: '320',
      mit_community: '320',
      mit_student: '320',
      non_mit: '320',
    });
  });
});
