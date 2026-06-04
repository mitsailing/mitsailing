'use server';

import { headers } from 'next/headers';
import { auth } from '@/libs/auth';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/utils/emailValidation';

export type SignInEmailActionResult =
  | { state: 'invalid_email' }
  | {
      email: string;
      state: 'password' | 'reset_required' | 'reset_failed' | 'sign_up';
    };

function describeResetEmailError(error: unknown) {
  if (error instanceof Error) {
    return { errorMessage: error.message, errorName: error.name };
  }
  return {
    errorMessage:
      typeof error === 'string'
        ? error
        : 'Unknown password reset email request failure',
    errorName: typeof error,
  };
}

export async function resolveSignInEmailAction(input: {
  email: string;
}): Promise<SignInEmailActionResult> {
  const email = normalizeEmailAddress(input.email);
  if (!isValidEmailAddress(email)) {
    return { state: 'invalid_email' };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      accounts: {
        select: { id: true },
        take: 1,
        where: { password: { not: null }, providerId: 'credential' },
      },
    },
  });

  if (!user) {
    return { email, state: 'sign_up' };
  }

  if (user.accounts.length > 0) {
    return { email, state: 'password' };
  }

  try {
    await auth.api.requestPasswordResetEmailOTP({
      body: { email },
      headers: await headers(),
    });
  } catch (error) {
    logger.warn('Failed to send password reset email OTP for user sign-in', {
      email,
      ...describeResetEmailError(error),
    });
    return { email, state: 'reset_failed' };
  }

  return { email, state: 'reset_required' };
}
