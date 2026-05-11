import { describe, expect, it } from 'vitest';
import { mapClassCategoriesToNavDropdownItems } from './classQueries';
import { mapFleetBoatsToNavDropdownItems } from './fleetQueries';
import {
  hrefClassesCategoryFromSlug,
  hrefFleetBoatFromSlug,
  mapNameSlugRowsToNavLinks,
} from './mapNavLinksFromNameSlug';

describe('mapNameSlugRowsToNavLinks', () => {
  it('preserves caller order', () => {
    const rows = [
      { name: 'Last', slug: 'z' },
      { name: 'First', slug: 'a' },
    ];
    expect(
      mapNameSlugRowsToNavLinks(rows, hrefClassesCategoryFromSlug)
    ).toEqual([
      { label: 'Last', href: '/classes#z' },
      { label: 'First', href: '/classes#a' },
    ]);
  });

  it('returns an empty array for no rows', () => {
    expect(mapNameSlugRowsToNavLinks([], hrefFleetBoatFromSlug)).toEqual([]);
  });
});

describe('hrefClassesCategoryFromSlug', () => {
  it('anchors the category slug hash', () => {
    expect(hrefClassesCategoryFromSlug('intro')).toBe('/classes#intro');
    expect(hrefClassesCategoryFromSlug('intro & racing')).toBe(
      '/classes#intro%20%26%20racing'
    );
  });
});

describe('hrefFleetBoatFromSlug', () => {
  it('normalizes trailing path segment', () => {
    expect(hrefFleetBoatFromSlug('club-420')).toBe('/fleet/club-420');
    expect(hrefFleetBoatFromSlug('tech dinghy')).toBe('/fleet/tech%20dinghy');
  });
});

describe('mapClassCategoriesToNavDropdownItems', () => {
  it('matches shared mapper with category hrefs', () => {
    const rows = [{ name: 'Last', slug: 'zeta' }];
    expect(mapClassCategoriesToNavDropdownItems(rows)).toEqual(
      mapNameSlugRowsToNavLinks(rows, hrefClassesCategoryFromSlug)
    );
  });
});

describe('mapFleetBoatsToNavDropdownItems', () => {
  it('matches shared mapper with fleet hrefs', () => {
    const rows = [{ name: 'B', slug: 'bb' }];
    expect(mapFleetBoatsToNavDropdownItems(rows)).toEqual(
      mapNameSlugRowsToNavLinks(rows, hrefFleetBoatFromSlug)
    );
  });
});
