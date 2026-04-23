import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import * as z from 'zod';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { CounterValidation } from '@/validations/CounterValidation';

export const PUT = async (request: Request) => {
  const json = await request.json();
  const parse = CounterValidation.safeParse(json);

  if (!parse.success) {
    return NextResponse.json(z.treeifyError(parse.error), { status: 422 });
  }

  // `x-e2e-random-id` is used for end-to-end testing to make isolated requests
  // The default value is 0 when there is no `x-e2e-random-id` header
  const headersList = await headers();
  const id = Number(headersList.get('x-e2e-random-id')) || 0;

  const { increment } = parse.data;

  const row = await prisma.counter.upsert({
    where: { id },
    create: {
      id,
      count: increment,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    update: {
      count: {
        increment,
      },
    },
  });

  logger.info('Counter has been incremented');

  return NextResponse.json({
    count: row.count,
  });
};
