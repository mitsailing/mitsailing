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
});
