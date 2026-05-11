import { describe, expect, it } from 'vitest';
import { catalogFieldUsesRichText } from './catalogDefinitions';

describe('catalogFieldUsesRichText', () => {
  it('returns true for fleet and sailing class description', () => {
    expect(catalogFieldUsesRichText('fleet', 'description')).toBe(true);
    expect(catalogFieldUsesRichText('sailing_classes', 'description')).toBe(
      true
    );
    expect(catalogFieldUsesRichText('cms_page_blocks', 'body')).toBe(true);
  });

  it('returns false for textarea catalog fields', () => {
    expect(catalogFieldUsesRichText('donation_funds', 'description')).toBe(
      false
    );
    expect(catalogFieldUsesRichText('site_alerts', 'body')).toBe(false);
  });

  it('returns false for unknown field names', () => {
    expect(catalogFieldUsesRichText('fleet', 'name')).toBe(false);
  });
});
