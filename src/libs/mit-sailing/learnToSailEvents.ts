import { LearnToSailManagedClassKind } from '@/generated/prisma/enums';
import type { LearnToSailManagedClassKind as LearnToSailManagedClassKindValue } from '@/generated/prisma/enums';

export function eventUsesLearnToSailWaitlist(event: {
  learnToSailManagedClassKind: LearnToSailManagedClassKindValue | null;
}): boolean {
  return (
    event.learnToSailManagedClassKind !== null &&
    event.learnToSailManagedClassKind !== LearnToSailManagedClassKind.none
  );
}
