import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { mitRecreationMembershipHref } from '@/data/mit-sailing/mitRecreationMembership';
import { PricingPageView } from './PricingPageView';

const meta = {
  title: 'MIT Sailing/PricingPageView',
  component: PricingPageView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    isSignedIn: false,
  },
} satisfies Meta<typeof PricingPageView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Guest: Story = {};
Guest.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const requestCardLinks = canvas.getAllByRole('link', {
    name: 'Sign up',
  });
  await expect(requestCardLinks.length).toBeGreaterThan(0);
  await expect(requestCardLinks[0]).toHaveAttribute(
    'href',
    '/signup?callbackUrl=%2Fonboarding'
  );
  const rateLinks = canvas.getAllByRole('link', {
    name: /See MIT Recreation rates/u,
  });
  await expect(rateLinks.length).toBeGreaterThan(0);
  await expect(rateLinks[0]).toHaveAttribute(
    'href',
    mitRecreationMembershipHref
  );
  await expect(rateLinks[0]).toHaveAttribute('target', '_blank');
};
