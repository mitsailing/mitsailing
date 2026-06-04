'use server';

import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/libs/DB';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/utils/emailValidation';

export type PasswordResetSupportAction =
  | 'create_password_email_not_received'
  | 'password_reset_email_not_received';

export type PasswordResetIssueResult =
  | { ok: true }
  | { error: 'invalid_email'; ok: false };

export async function reportPasswordResetIssueAction(input: {
  action: PasswordResetSupportAction;
  email: string;
}): Promise<PasswordResetIssueResult> {
  const email = normalizeEmailAddress(input.email);
  if (!isValidEmailAddress(email)) {
    return { error: 'invalid_email', ok: false };
  }

  const user = await prisma.user.findUnique({
    select: { id: true },
    where: { email },
  });
  const userId = user?.id ?? null;

  Sentry.captureMessage('Password reset support requested', {
    extra: {
      action: input.action,
      email,
      userId,
    },
    level: 'warning',
    tags: {
      action: input.action,
      userFound: userId ? 'true' : 'false',
    },
    user: userId ? { email, id: userId } : { email },
  });

  return { ok: true };
}
