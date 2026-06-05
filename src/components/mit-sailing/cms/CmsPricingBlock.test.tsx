import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CmsPricingData } from '@/libs/mit-sailing/cmsPricing';
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
  it('renders three pricing plans in the compact public grid', () => {
    const view = render(
      <CmsPricingBlock
        block={pricingBlock({
          plans: [
            { features: ['One'], price: '$10', title: 'One' },
            { features: ['Two'], price: '$20', title: 'Two' },
            { features: ['Three'], price: '$30', title: 'Three' },
          ],
        })}
      />
    );

    expect(screen.getByRole('heading', { name: 'One' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Two' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Three' })).toBeVisible();
    expect(
      view.container.querySelector(String.raw`.lg\:grid-cols-3`)
    ).toBeInTheDocument();
  });

  it('renders four pricing plans in the full public grid', () => {
    const view = render(
      <CmsPricingBlock
        block={pricingBlock({
          plans: [
            { features: ['One'], price: '$10', title: 'One' },
            { features: ['Two'], price: '$20', title: 'Two' },
            { features: ['Three'], price: '$30', title: 'Three' },
            { features: ['Four'], price: '$40', title: 'Four' },
          ],
        })}
      />
    );

    expect(screen.getByRole('heading', { name: 'Four' })).toBeVisible();
    expect(
      view.container.querySelector(String.raw`.lg\:grid-cols-4`)
    ).toBeInTheDocument();
  });

  it('renders highlighted pricing plans with price rows and external links', () => {
    render(
      <CmsPricingBlock
        block={pricingBlock({
          footnote: 'Rates apply to current members.',
          footnoteLinkLabel: 'Policy',
          footnoteLinkUrl: 'https://sailing.mit.edu/policy',
          plans: [
            {
              badge: 'Popular',
              description: 'Best for active sailors.',
              features: ['Sailing card', 'Boat access'],
              highlighted: true,
              linkLabel: 'Choose plan',
              linkUrl: 'https://sailing.mit.edu/join',
              price: 'From $25',
              priceRows: [
                { label: 'Students', value: '$25' },
                { label: 'Affiliates', value: '$55' },
              ],
              title: 'Annual',
            },
          ],
        })}
      />
    );

    expect(screen.getByRole('heading', { name: 'Membership' })).toBeVisible();
    expect(screen.getByText('Popular')).toBeVisible();
    expect(screen.getByText('Best for active sailors.')).toBeVisible();
    expect(screen.getByText('Students')).toBeVisible();
    expect(screen.getByText('$25')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Choose plan' })).toHaveAttribute(
      'target',
      '_blank'
    );
    expect(screen.getByRole('link', { name: 'Policy' })).toHaveAttribute(
      'href',
      'https://sailing.mit.edu/policy'
    );
  });

  it('renders fallback pricing data when a CMS body is empty', () => {
    const fallbackData: CmsPricingData = {
      plans: [
        {
          features: ['Class registration'],
          frequency: 'per season',
          linkLabel: 'Sign up',
          linkUrl: '/classes',
          price: '$10',
          title: 'Class pass',
        },
        {
          features: ['Extra checkout'],
          price: '$20',
          title: 'Guest',
        },
      ],
    };

    render(
      <CmsPricingBlock block={pricingBlock('')} fallbackData={fallbackData} />
    );

    expect(screen.getByText('Class pass')).toBeVisible();
    expect(screen.getByText('per season')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      '/classes'
    );
    expect(screen.getByText('Guest')).toBeVisible();
  });

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

  it('renders nothing when pricing plan titles are duplicated', () => {
    const view = render(
      <CmsPricingBlock
        block={pricingBlock({
          plans: [
            {
              features: ['Sailing'],
              price: '$10',
              title: 'Member',
            },
            {
              features: ['Racing'],
              price: '$20',
              title: 'Member',
            },
          ],
        })}
      />
    );

    expect(view.container).toBeEmptyDOMElement();
  });
});
