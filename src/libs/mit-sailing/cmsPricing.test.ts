import { describe, expect, it } from 'vitest';
import { parseCmsPricingBody } from '@/libs/mit-sailing/cmsPricing';

describe('parseCmsPricingBody', () => {
  it('rejects malformed plans instead of dropping them', () => {
    expect(
      parseCmsPricingBody(
        JSON.stringify({
          plans: [
            { title: 'Member', price: '$10', features: ['Sailing'] },
            { title: 'Broken', features: ['Missing price'] },
          ],
        })
      )
    ).toBeNull();
  });

  it('rejects duplicate plan titles', () => {
    expect(
      parseCmsPricingBody(
        JSON.stringify({
          plans: [
            { title: 'Member', price: '$10', features: ['Sailing'] },
            { title: 'Member', price: '$20', features: ['Racing'] },
          ],
        })
      )
    ).toBeNull();
  });

  it('keeps only safe plan link urls', () => {
    const parsed = parseCmsPricingBody(
      JSON.stringify({
        plans: [
          {
            title: 'Member',
            price: '$10',
            features: ['Sailing'],
            linkUrl: ['java', 'script:alert(1)'].join(''),
          },
        ],
      })
    );

    expect(parsed?.plans[0]).toMatchObject({
      features: ['Sailing'],
      price: '$10',
      title: 'Member',
    });
    expect(parsed?.plans[0]?.linkUrl).toBeUndefined();
  });

  it('keeps safe footnote link urls', () => {
    const parsed = parseCmsPricingBody(
      JSON.stringify({
        footnote: 'Need details?',
        footnoteLinkLabel: 'See MIT Gym pricing',
        footnoteLinkUrl: '/pricing',
        plans: [
          {
            title: 'Member',
            price: '$10',
            features: ['Sailing'],
          },
        ],
      })
    );

    expect(parsed).toMatchObject({
      footnote: 'Need details?',
      footnoteLinkLabel: 'See MIT Gym pricing',
      footnoteLinkUrl: '/pricing',
    });
  });
});
