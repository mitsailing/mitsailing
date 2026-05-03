import { prisma } from '@/libs/DB';

export type VisibleDonationFundRow = {
  id: string;
  fundId: string;
  name: string;
  description: string;
  url: string;
};

/**
 * Published donation funds for the marketing donate page: visible rows only,
 * ordered by `displayOrder` then fund id.
 *
 * @returns Selected fund fields including `url` for outbound links
 */
export async function getVisibleDonationFunds(): Promise<
  readonly VisibleDonationFundRow[]
> {
  const rows = await prisma.donationFund.findMany({
    where: { isVisible: true },
    orderBy: [{ displayOrder: 'asc' }, { fundId: 'asc' }],
    select: {
      id: true,
      fundId: true,
      name: true,
      description: true,
      url: true,
    },
  });
  return rows;
}
