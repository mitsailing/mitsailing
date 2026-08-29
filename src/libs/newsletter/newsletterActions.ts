'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { requireCurrentUser } from '@/libs/auth/dal';
import { logger } from '@/libs/Logger';
import { NEWSLETTER_FORM_SOURCE } from '@/libs/newsletter/newsletterConstants';
import {
  getSubscriberPreferenceStateForUser,
  getSubscriberPreferenceStateByToken,
  subscribeEmailToNewsletterLists,
  updateNewsletterPreferences,
} from '@/libs/newsletter/newsletterSubscriptions';
import { validateNewsletterSignupFormData } from '@/libs/newsletter/newsletterValidation';
import type {
  NewsletterSignupField,
  NewsletterSignupFieldError,
} from '@/libs/newsletter/newsletterValidation';
import { checkRateLimit, newsletterSignupRateLimit } from '@/libs/rateLimit';
import { getI18nPath } from '@/utils/Helpers';

export type NewsletterSignupFormError = 'rate_limited' | 'unknown';

export type NewsletterSignupFormState =
  | {
      ok: true;
      fieldErrors?: never;
      formError?: never;
    }
  | {
      ok: false;
      fieldErrors?: Partial<
        Record<NewsletterSignupField, NewsletterSignupFieldError>
      >;
      formError?: NewsletterSignupFormError;
    };

export type NewsletterPreferenceActionResult =
  | { ok: true }
  | { ok: false; error: 'invalid_token' | 'unauthorized' | 'unknown' };

const REQUEST_METADATA_MAX_LENGTH = 500;

function firstForwardedIp(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const [first] = value.split(',');
  const trimmed = first?.trim();
  return trimmed && trimmed.length > 0
    ? trimmed.slice(0, REQUEST_METADATA_MAX_LENGTH)
    : null;
}

function truncateMetadata(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0
    ? trimmed.slice(0, REQUEST_METADATA_MAX_LENGTH)
    : null;
}

function selectedListIds(formData: FormData): string[] {
  return formData
    .getAll('listId')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/**
 * Stores public newsletter signup preferences.
 *
 * @param locale - Active locale
 * @param _previousState - Previous form state
 * @param formData - Submitted signup data
 * @returns New form state
 */
export async function submitNewsletterSignupAction(
  locale: string,
  _previousState: NewsletterSignupFormState,
  formData: FormData
): Promise<NewsletterSignupFormState> {
  const parsed = validateNewsletterSignupFormData(formData);
  if (parsed.spam) {
    return { ok: true };
  }
  if (!parsed.ok) {
    return { ok: false, fieldErrors: parsed.fieldErrors };
  }

  const headerList = await headers();
  const ipAddress =
    firstForwardedIp(headerList.get('x-forwarded-for')) ??
    truncateMetadata(headerList.get('x-real-ip'));
  const userAgent = truncateMetadata(headerList.get('user-agent'));
  const { rateLimited } = await checkRateLimit({
    ...newsletterSignupRateLimit,
    key: ipAddress ?? 'unknown',
  });
  if (rateLimited) {
    return { ok: false, formError: 'rate_limited' };
  }

  try {
    await subscribeEmailToNewsletterLists({
      email: parsed.data.email,
      ipAddress,
      listSlugs: parsed.data.listSlugs,
      name: parsed.data.name,
      source: NEWSLETTER_FORM_SOURCE.publicSignup,
      userAgent,
    });
  } catch (error) {
    logger.error('Failed to save public newsletter signup: {error}', {
      error,
    });
    return { ok: false, formError: 'unknown' };
  }

  revalidatePath(getI18nPath('/newsletter', locale));
  return { ok: true };
}

/**
 * Persists authenticated user newsletter preferences.
 *
 * @param locale - Active locale
 * @param formData - Submitted preference form
 * @returns Action result
 */
export async function updateProfileNewsletterPreferencesAction(
  locale: string,
  formData: FormData
): Promise<NewsletterPreferenceActionResult> {
  const user = await requireCurrentUser(locale, '/profile/newsletter');
  try {
    const subscriber = await getSubscriberPreferenceStateForUser(user.id);
    if (!subscriber) {
      return { ok: false, error: 'unauthorized' };
    }
    await updateNewsletterPreferences({
      actorUserId: user.id,
      listIds: selectedListIds(formData),
      source: NEWSLETTER_FORM_SOURCE.profile,
      subscriberId: subscriber.id,
    });
  } catch (error) {
    logger.error('Failed to update profile newsletter preferences: {error}', {
      error,
      userId: user.id,
    });
    return { ok: false, error: 'unknown' };
  }
  revalidatePath(getI18nPath('/profile/newsletter', locale));
  revalidatePath(getI18nPath('/newsletter', locale));
  return { ok: true };
}

/**
 * Persists tokenized public newsletter preferences.
 *
 * @param token - Manage token from email
 * @param locale - Active locale
 * @param formData - Submitted preference form
 * @returns Action result
 */
export async function updateTokenNewsletterPreferencesAction(
  token: string,
  locale: string,
  formData: FormData
): Promise<NewsletterPreferenceActionResult> {
  try {
    const subscriber = await getSubscriberPreferenceStateByToken(token);
    if (!subscriber) {
      return { ok: false, error: 'invalid_token' };
    }
    await updateNewsletterPreferences({
      listIds: selectedListIds(formData),
      source: NEWSLETTER_FORM_SOURCE.tokenManage,
      subscriberId: subscriber.id,
    });
  } catch (error) {
    logger.error('Failed to update token newsletter preferences: {error}', {
      error,
    });
    return { ok: false, error: 'unknown' };
  }
  revalidatePath(getI18nPath('/newsletter/manage', locale));
  return { ok: true };
}
