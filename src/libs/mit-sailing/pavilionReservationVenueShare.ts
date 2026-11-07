const VENUE_SHARE_HASH_BY_SLUG: Readonly<Record<string, string>> = {
  casual_dock: 'venue-dock',
  roof_deck: 'venue-roof',
};

/**
 * Returns the deep-link hash for a pavilion venue slug.
 *
 * @param slug - Catalog slug such as casual_dock
 * @returns Hash without the leading #, e.g. venue-dock
 */
export function pavilionReservationVenueShareHash(slug: string) {
  return VENUE_SHARE_HASH_BY_SLUG[slug] ?? `venue-${slug}`;
}

/**
 * Builds a share URL with a venue hash and no trailing slash before it.
 *
 * @param pageUrl - Current reserve page URL without a venue hash
 * @param hash - Venue hash without #
 * @returns Absolute URL with the venue fragment
 */
export function pavilionReservationVenueShareUrl(
  pageUrl: string,
  hash: string
) {
  const url = new URL(pageUrl);
  url.hash = hash;
  return url.toString();
}

export type PavilionVenueShareResult = 'aborted' | 'copied' | 'shared';

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Shares a pavilion venue via the Web Share API, with clipboard fallback.
 *
 * @param props - Translated share copy, page URL, and injected share/copy boundaries
 * @returns Whether the user shared, copied, or cancelled
 */
export async function sharePavilionReservationVenue(props: {
  copyText: (text: string) => Promise<void>;
  pageUrl: string;
  share?: (data: ShareData) => Promise<void>;
  slug: string;
  text: string;
  title: string;
}): Promise<PavilionVenueShareResult> {
  const hash = pavilionReservationVenueShareHash(props.slug);
  const url = pavilionReservationVenueShareUrl(props.pageUrl, hash);
  const payload = {
    text: props.text,
    title: props.title,
    url,
  };

  if (props.share) {
    try {
      await props.share(payload);
      return 'shared';
    } catch (error) {
      if (isAbortError(error)) {
        return 'aborted';
      }
    }
  }

  await props.copyText(`${props.text}\n${url}`);
  return 'copied';
}
