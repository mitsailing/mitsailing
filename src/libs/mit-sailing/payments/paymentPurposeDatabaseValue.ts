import { PaymentPurpose } from '@/generated/prisma/enums';

const paymentPurposeDatabaseValues: Record<PaymentPurpose, string> = {
  [PaymentPurpose.event_payment]: 'event',
  [PaymentPurpose.membership]: 'membership',
};

/**
 * Returns the Postgres `payment_purpose` enum label for raw SQL.
 *
 * @param purpose - Prisma payment purpose enum value
 * @returns Database enum label used in raw SQL
 */
export function paymentPurposeDatabaseValue(purpose: PaymentPurpose): string {
  return paymentPurposeDatabaseValues[purpose];
}
