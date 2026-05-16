import { Env } from '@/libs/Env';
import { getBaseUrl } from '@/utils/Helpers';

export const NEWSLETTER_ARCHIVE_PATH = '/newsletter/archive';
const NEWSLETTER_ARCHIVE_REVALIDATION_PATH =
  '/api/internal/newsletter/archive/revalidate';

export async function requestNewsletterArchiveRevalidation(): Promise<boolean> {
  try {
    const response = await fetch(
      new URL(NEWSLETTER_ARCHIVE_REVALIDATION_PATH, getBaseUrl()),
      {
        headers: {
          authorization: `Bearer ${Env.NEWSLETTER_REVALIDATE_SECRET}`,
        },
        method: 'POST',
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}
