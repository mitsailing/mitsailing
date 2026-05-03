/**
 * Seed rows for `DonationFund`. Dev/test uses {@link SAMPLE_DONATION_URL}; production
 * stores real URLs in the `url` column.
 */

/** Reserved example host (RFC 2606); valid `href` for seeds. */
export const SAMPLE_DONATION_URL = 'https://example.com';

export type DonationFundSeedRow = {
  id: string;
  /** MIT giving designation / fund number (stored as `designation_id` in DB). */
  fundId: string;
  name: string;
  description: string;
  url: string;
  displayOrder: number;
  isVisible: boolean;
};

function withSampleUrl(
  row: Omit<DonationFundSeedRow, 'url'>
): DonationFundSeedRow {
  return { ...row, url: SAMPLE_DONATION_URL };
}

/**
 * Eight MIT designation funds (names/descriptions match legacy locale copy).
 * Display orders are non-sequential to catch sorting bugs; `3844065` is hidden.
 */
export const DONATION_FUND_SEED_ROWS: readonly DonationFundSeedRow[] = [
  withSampleUrl({
    id: 'df-2437800',
    fundId: '2437800',
    name: "Friends of Sailing, Intercollegiate Men's and Women's",
    description:
      'Support the travel, entry fees, and coaching required for our competitive varsity teams to race nationally.',
    displayOrder: 50,
    isVisible: true,
  }),
  withSampleUrl({
    id: 'df-3650100',
    fundId: '3650100',
    name: 'Ralph L. Evans, Jr (1948) Fund',
    description:
      'Provides unrestricted endowment support to sustain the operational excellence of the MIT Sailing program.',
    displayOrder: 10,
    isVisible: true,
  }),
  withSampleUrl({
    id: 'df-3663200',
    fundId: '3663200',
    name: 'Sailing Fleet Endowment Fund',
    description:
      'Ensures long-term financial stability for the continuous maintenance and replacement of our diverse sailing fleet.',
    displayOrder: 40,
    isVisible: true,
  }),
  withSampleUrl({
    id: 'df-2737867',
    fundId: '2737867',
    name: 'Sailing Fleet Renewal Fund',
    description:
      'Directly funds the immediate purchase of new boats, sails, and essential on-the-water equipment.',
    displayOrder: 30,
    isVisible: true,
  }),
  withSampleUrl({
    id: 'df-3714200',
    fundId: '3714200',
    name: 'Sailing Pavilion Dock Renovation Fund',
    description:
      'Contributes to critical infrastructure upgrades and renovations for our historic sailing pavilion and docks.',
    displayOrder: 20,
    isVisible: true,
  }),
  withSampleUrl({
    id: 'df-2732358',
    fundId: '2732358',
    name: 'Sailing, Recreational Program',
    description:
      'Supports open-access recreational sailing, beginner classes, and safety gear for the entire MIT community.',
    displayOrder: 5,
    isVisible: true,
  }),
  withSampleUrl({
    id: 'df-3844065',
    fundId: '3844065',
    name: 'Sports Performance Equipment Fund',
    description:
      'Equips our teams with advanced training tools, fitness gear, and performance analysis technology.',
    displayOrder: 60,
    isVisible: false,
  }),
  withSampleUrl({
    id: 'df-3259990',
    fundId: '3259990',
    name: 'Varsity Sailing Head Coach Endowed Fund',
    description:
      'Provides permanent support for the head coaching position, ensuring elite leadership for our varsity sailors.',
    displayOrder: 15,
    isVisible: true,
  }),
];

/**
 * Visible seed rows in the same order as the donate page query:
 * `display_order` ascending, then `designation_id` ascending.
 */
export function visibleDonationFundsInDisplayOrder(): readonly DonationFundSeedRow[] {
  return DONATION_FUND_SEED_ROWS.filter((row) => row.isVisible).toSorted(
    (a, b) =>
      a.displayOrder !== b.displayOrder
        ? a.displayOrder - b.displayOrder
        : a.fundId.localeCompare(b.fundId, undefined, { numeric: true })
  );
}

/**
 * Hidden fund row used by admin E2E to toggle visibility on the donate page.
 *
 * @returns The `df-3844065` seed row
 */
export function donationFundHiddenForE2e(): DonationFundSeedRow {
  const row = DONATION_FUND_SEED_ROWS.find((r) => r.id === 'df-3844065');
  if (!row) {
    throw new Error('donationFundHiddenForE2e: missing df-3844065 seed row');
  }
  return row;
}
