'use server';

import { isAPIError } from 'better-auth/api';
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
  if (isAPIError(error)) {
    const errorCode =
      typeof error.body === 'object' &&
      error.body !== null &&
      'code' in error.body &&
      typeof error.body.code === 'string'
        ? error.body.code
        : undefined;
    return {
      errorCode,
      errorMessage: error.message,
      errorName: 'APIError',
      errorStatus: error.status,
    };
  }
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

/**
 * Resolves the next login step for an email address.
 *
 * @param input - Email address submitted from the sign-in form
 * @returns Invalid-email, sign-up, password-entry, reset-required, or reset-failed state
 */
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
    logger.error('Failed to send password reset email OTP for user sign-in', {
      email,
      ...describeResetEmailError(error),
    });
    return { email, state: 'reset_failed' };
  }

  return { email, state: 'reset_required' };
}
