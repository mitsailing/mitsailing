import 'server-only';
import { prisma } from '@/libs/DB';

const FIRST_SAILING_CARD_NUMBER = 60;
export const MAX_SAILING_CARD_NUMBER = 9999;

type SailingCardNumberReader = {
  readonly user: {
    findMany: (args: {
      orderBy: { sailingCardNumber: 'asc' };
      select: { sailingCardNumber: true };
      where: {
        sailingCardNumber: { not: null };
        sailingCardYear: number;
      };
    }) => Promise<{ sailingCardNumber: number | null }[]>;
  };
};

export const getNextAvailableSailingCardNumber = async (props: {
  readonly cardYear: number;
  readonly db?: SailingCardNumberReader;
}) => {
  const db = props.db ?? prisma;
  const assignedCards = await db.user.findMany({
    where: {
      sailingCardNumber: { not: null },
      sailingCardYear: props.cardYear,
    },
    select: { sailingCardNumber: true },
    orderBy: { sailingCardNumber: 'asc' },
  });

  const usedNumbers = new Set(
    assignedCards.flatMap((card) =>
      card.sailingCardNumber === null ? [] : [card.sailingCardNumber]
    )
  );

  let nextNumber = FIRST_SAILING_CARD_NUMBER;
  while (usedNumbers.has(nextNumber)) {
    nextNumber += 1;
    if (nextNumber > MAX_SAILING_CARD_NUMBER) {
      throw new Error('No available sailing card numbers.');
    }
  }

  return nextNumber;
};
