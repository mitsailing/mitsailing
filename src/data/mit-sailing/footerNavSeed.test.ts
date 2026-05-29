import { describe, expect, it } from 'vitest';
import { footerNavColumns } from './footerNavSeed';

describe('footerNavColumns', () => {
  it('links the membership footer item to pricing', () => {
    const links = footerNavColumns.flatMap((column) => column.links);
    const membershipLink = links.find(
      (link) => link.labelKey === 'footer_link_membership'
    );

    expect(membershipLink).toEqual({
      labelKey: 'footer_link_membership',
      to: '/pricing',
    });
  });
});
