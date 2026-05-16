import { describe, expect, it } from 'vitest';
import { newsletterPreferenceRows } from '@/libs/newsletter/newsletterPreferenceRows';

describe('newsletter preference rows', () => {
  it('marks subscribed lists', () => {
    const rows = newsletterPreferenceRows(
      [
        { description: 'Club updates', id: 'general', name: 'General' },
        { description: null, id: 'racing', name: 'Racing' },
      ],
      {
        subscriptions: [
          { listId: 'general', status: 'subscribed' },
          { listId: 'racing', status: 'unsubscribed' },
        ],
      }
    );

    expect(rows).toEqual([
      {
        description: 'Club updates',
        id: 'general',
        name: 'General',
        subscribed: true,
      },
      { description: null, id: 'racing', name: 'Racing', subscribed: false },
    ]);
  });

  it('marks every list unsubscribed without a subscriber', () => {
    expect(
      newsletterPreferenceRows(
        [{ description: null, id: 'general', name: 'General' }],
        null
      )
    ).toEqual([
      { description: null, id: 'general', name: 'General', subscribed: false },
    ]);
  });
});
