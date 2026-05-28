import { Permission } from '@/libs/auth/permissions';

export const sailingCardReviewPermissions = [
  Permission.CARDS_REVIEW,
  Permission.CARDS_APPROVE,
  Permission.CARDS_ASSIGN_NUMBER,
] as const;
