import { createHash } from 'node:crypto';
import { sailingCardAgreement } from '@/libs/mit-sailing/sailingCardAgreementContent';

export { sailingCardAgreement };

export const sailingCardAgreementHash = () =>
  createHash('sha256').update(sailingCardAgreement.text).digest('hex');
