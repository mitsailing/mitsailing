import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
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
  await expect(
    canvas.getAllByRole('button', {
      name: 'See MIT Recreation rates',
    }).length
  ).toBeGreaterThan(0);
};

export const GymRatesLightbox: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [ratesButton] = canvas.getAllByRole('button', {
      name: 'See MIT Recreation rates',
    });
    if (!ratesButton) {
      throw new Error('Missing MIT Recreation rates button');
    }
    await userEvent.click(ratesButton);
    const dialog = await within(document.body).findByRole('dialog', {
      name: 'Annual membership rates',
    });
    await expect(dialog).toHaveAttribute('data-state', 'open');
    await expect(
      within(dialog).getAllByText('General public (Friends of MIT)').length
    ).toBeGreaterThan(0);
  },
};
