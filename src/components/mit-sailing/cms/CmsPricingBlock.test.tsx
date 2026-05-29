import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PublicCmsBlock } from '@/libs/mit-sailing/cmsQueries';
import { CmsPricingBlock } from './CmsPricingBlock';

function pricingBlock(body: unknown): PublicCmsBlock {
  return {
    body: JSON.stringify(body),
    id: 'pricing',
    kind: 'pricing',
    title: 'Membership',
  };
}

describe('CmsPricingBlock', () => {
  it('omits footnote markup when only the link label is present', () => {
    const view = render(
      <CmsPricingBlock
        block={pricingBlock({
          footnoteLinkLabel: 'Bad link',
          plans: [
            {
              features: ['Sailing'],
              price: '$10',
              title: 'Member',
            },
          ],
        })}
      />
    );

    expect(screen.queryByText('Bad link')).not.toBeInTheDocument();
    expect(view.container.querySelector('p')).toBeNull();
  });
});
