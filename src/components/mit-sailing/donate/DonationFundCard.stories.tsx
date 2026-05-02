import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SAMPLE_DONATION_URL } from '@/data/mit-sailing/donationFundsSeed';
import { DonationFundCard } from './DonationFundCard';

const meta = {
  title: 'MIT Sailing/Donate/FundCard',
  component: DonationFundCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Fund row on the donate page: designation badge, description, and external Give button.',
      },
    },
  },
  args: {
    name: "Friends of Sailing, Intercollegiate Men's and Women's",
    description:
      'Support the travel, entry fees, and coaching required for our competitive varsity teams to race nationally.',
    fundNumberLabel: 'Fund #2437800',
    giveLabel: 'Give',
    url: SAMPLE_DONATION_URL,
  },
  argTypes: {
    url: {
      description:
        'Giving URL from the database (typically opens in a new tab).',
    },
    fundNumberLabel: {
      description: 'Rendered designation label (e.g. Fund #2437800).',
    },
  },
} satisfies Meta<typeof DonationFundCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongTitle: Story = {
  args: {
    name: 'Sailing Pavilion Dock Renovation Fund — capital improvements and accessibility updates for the waterfront facility used by varsity and recreational programs across MIT.',
    description:
      'Contributes to critical infrastructure upgrades and renovations for our historic sailing pavilion and docks.',
  },
};
