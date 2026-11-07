import { describe, expect, it, vi } from 'vitest';
import {
  pavilionReservationVenueShareHash,
  pavilionReservationVenueShareUrl,
  sharePavilionReservationVenue,
} from '@/libs/mit-sailing/pavilionReservationVenueShare';

describe('pavilionReservationVenueShareHash', () => {
  it('maps dock and roof slugs to venue deep-link hashes', () => {
    expect(pavilionReservationVenueShareHash('casual_dock')).toBe('venue-dock');
    expect(pavilionReservationVenueShareHash('roof_deck')).toBe('venue-roof');
    expect(pavilionReservationVenueShareHash('other_space')).toBe(
      'venue-other_space'
    );
  });
});

describe('sharePavilionReservationVenue', () => {
  it('prefers the web share api and copies when share is missing', async () => {
    const share = vi.fn(async () => {
      await Promise.resolve();
    });
    const copyText = vi.fn(async () => {
      await Promise.resolve();
    });

    await expect(
      sharePavilionReservationVenue({
        copyText,
        pageUrl: 'http://localhost:3000/reserve',
        share,
        slug: 'casual_dock',
        text: 'Take a look at this Pavilion space: Casual dock. Classroom plus dock.',
        title: 'Casual dock at the Pavilion',
      })
    ).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({
      text: 'Take a look at this Pavilion space: Casual dock. Classroom plus dock.',
      title: 'Casual dock at the Pavilion',
      url: 'http://localhost:3000/reserve#venue-dock',
    });
    expect(copyText).not.toHaveBeenCalled();

    await expect(
      sharePavilionReservationVenue({
        copyText,
        pageUrl: 'http://localhost:3000/reserve',
        slug: 'roof_deck',
        text: 'Take a look at this Pavilion space: East roof deck. Most private outdoor area.',
        title: 'East roof deck at the Pavilion',
      })
    ).resolves.toBe('copied');
    expect(copyText).toHaveBeenCalledWith(
      'Take a look at this Pavilion space: East roof deck. Most private outdoor area.\nhttp://localhost:3000/reserve#venue-roof'
    );
  });

  it('treats share abort as a cancelled share', async () => {
    const abort = new DOMException('The user canceled.', 'AbortError');
    const copyText = vi.fn(async () => {
      await Promise.resolve();
    });

    await expect(
      sharePavilionReservationVenue({
        copyText,
        pageUrl: 'http://localhost:3000/reserve',
        share: () => {
          throw abort;
        },
        slug: 'casual_dock',
        text: 'Take a look at this Pavilion space: Casual dock. Classroom plus dock.',
        title: 'Casual dock at the Pavilion',
      })
    ).resolves.toBe('aborted');
    expect(copyText).not.toHaveBeenCalled();
  });
});

describe('pavilionReservationVenueShareUrl', () => {
  it('appends the venue hash without a trailing slash before it', () => {
    expect(
      pavilionReservationVenueShareUrl(
        'http://localhost:3000/reserve',
        'venue-dock'
      )
    ).toBe('http://localhost:3000/reserve#venue-dock');
  });
});
