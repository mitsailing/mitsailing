import { describe, expect, it } from 'vitest';
import {
  getDefaultSiteTextValue,
  listSiteTextEntries,
  listStaleSiteTextOverrides,
  mergeSiteTextMessages,
  validateSiteTextOverrideValue,
} from '@/libs/site-text/siteTextMessages';
import type { MessageCatalog } from '@/libs/site-text/siteTextMessages';

const messages: MessageCatalog = {
  HomePage: {
    hero_title: 'Sail the Charles River',
    footer: 'Copyright {year}',
    support: 'Contact <support>{email}</support>',
  },
  AdminPage: {
    title: 'Admin',
  },
};

describe('siteTextMessages', () => {
  describe('getDefaultSiteTextValue', () => {
    it('returns default text for known keys', () => {
      expect(getDefaultSiteTextValue('HomePage', 'hero_title', messages)).toBe(
        'Sail the Charles River'
      );
    });

    it('returns null for unknown keys', () => {
      expect(getDefaultSiteTextValue('HomePage', 'missing', messages)).toBe(
        null
      );
    });
  });

  describe('mergeSiteTextMessages', () => {
    it('applies overrides for known keys', () => {
      const merged = mergeSiteTextMessages(messages, [
        {
          namespace: 'HomePage',
          key: 'hero_title',
          value: 'Learn to sail at MIT',
        },
      ]);

      expect(merged.HomePage?.hero_title).toBe('Learn to sail at MIT');
      expect(messages.HomePage?.hero_title).toBe('Sail the Charles River');
    });

    it('ignores overrides for stale keys', () => {
      const merged = mergeSiteTextMessages(messages, [
        {
          namespace: 'HomePage',
          key: 'missing',
          value: 'Ignored',
        },
      ]);

      expect(merged.HomePage?.missing).toBeUndefined();
    });
  });

  describe('validateSiteTextOverrideValue', () => {
    it('accepts matching placeholders and tags', () => {
      expect(
        validateSiteTextOverrideValue(
          'Contact <support>{email}</support>',
          'Email <support>{email}</support>'
        )
      ).toEqual({ ok: true });
    });

    it('rejects missing placeholders', () => {
      expect(
        validateSiteTextOverrideValue('Copyright {year}', 'Copyright')
      ).toEqual({ ok: false, code: 'placeholder_mismatch' });
    });

    it('rejects missing rich tags', () => {
      expect(
        validateSiteTextOverrideValue(
          'Contact <support>{email}</support>',
          'Contact {email}'
        )
      ).toEqual({ ok: false, code: 'placeholder_mismatch' });
    });
  });

  describe('listSiteTextEntries', () => {
    it('marks live values with override metadata', () => {
      const rows = listSiteTextEntries(
        [
          {
            namespace: 'HomePage',
            key: 'hero_title',
            value: 'Learn to sail at MIT',
            updatedAt: new Date('2026-05-06T12:00:00.000Z'),
            updatedBy: {
              name: 'Admin User',
              email: 'admin@example.com',
            },
          },
        ],
        messages
      );

      const row = rows.find(
        (item) => item.namespace === 'HomePage' && item.key === 'hero_title'
      );

      expect(row).toMatchObject({
        defaultValue: 'Sail the Charles River',
        liveValue: 'Learn to sail at MIT',
        overrideValue: 'Learn to sail at MIT',
        updatedByName: 'Admin User',
        updatedByEmail: 'admin@example.com',
      });
    });
  });

  describe('listStaleSiteTextOverrides', () => {
    it('returns overrides without file keys', () => {
      expect(
        listStaleSiteTextOverrides(
          [
            {
              namespace: 'HomePage',
              key: 'missing',
              value: 'Ignored',
            },
            {
              namespace: 'AdminPage',
              key: 'title',
              value: 'Admin',
            },
          ],
          messages
        )
      ).toEqual([
        {
          namespace: 'HomePage',
          key: 'missing',
          value: 'Ignored',
        },
      ]);
    });
  });
});
