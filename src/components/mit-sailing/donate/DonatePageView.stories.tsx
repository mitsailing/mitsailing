import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { DonatePageViewProps } from '@/components/mit-sailing/donate/DonatePageView';
import { DonatePageView } from '@/components/mit-sailing/donate/DonatePageView';
import { SAMPLE_DONATION_URL } from '@/data/mit-sailing/donationFundsSeed';

const baseProps = {
  heading: 'Giving to MIT Sailing',
  introParagraphs: [
    'Philanthropy advances MIT Sailing’s mission.',
    'Select a fund below to make a designated online gift.',
  ] as [string, string],
  corporateGiving: {
    heading: 'Foundation and corporate philanthropy',
    body: 'The Institute welcomes philanthropic partnerships.',
    contactIntro: 'To discuss giving, please contact',
    contactName: 'Example Contact',
    contactRole: 'Director',
    contactEmail: 'giving@example.edu',
  },
  individualHeading: 'Make a gift online',
  giveCta: 'Give',
  supportHeading: 'Other ways to support',
  mailingTitle: 'Join our mailing list',
  mailingBody: 'Stay updated on events.',
  mailingLinkLabel: 'Subscribe',
  mailingHref: '/contact',
  volunteerTitle: 'Volunteer with us',
  volunteerBody: 'Become a mentor.',
  volunteerLinkLabel: 'Learn more',
  volunteerHref: '/contact',
  alternateGiving: {
    heading: 'Other ways to give',
    blocks: [
      {
        title: 'Donate by check',
        body: 'Make checks payable to the Institute.',
      },
    ],
    contactHeading: 'Or reach out',
    contactIntro: 'We welcome questions.',
    contactName: 'Example Contact',
    contactRole: 'Director',
    contactEmail: 'giving@example.edu',
    legalDisclaimer: 'Gifts may be tax-deductible as provided by law.',
  },
  fundNumberLabel: (fundId: string) => `Fund #${fundId}`,
} satisfies Omit<DonatePageViewProps, 'funds'>;

const sampleFunds: DonatePageViewProps['funds'] = [
  {
    id: 'df-a',
    fundId: '2732358',
    name: 'Sailing, Recreational Program',
    description: 'Supports recreational sailing and beginner classes.',
    url: SAMPLE_DONATION_URL,
  },
  {
    id: 'df-b',
    fundId: '3650100',
    name: 'Ralph L. Evans, Jr (1948) Fund',
    description: 'Provides unrestricted endowment support.',
    url: SAMPLE_DONATION_URL,
  },
];

const meta = {
  title: 'MIT Sailing/Donate/PageView',
  component: DonatePageView,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Full donate marketing column: hero, corporate block, fund cards (DB-driven on the site), alternate giving, and support options.',
      },
    },
  },
  args: {
    ...baseProps,
    funds: sampleFunds,
  },
} satisfies Meta<typeof DonatePageView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmptyFunds: Story = {
  args: {
    funds: [],
  },
};

export const SingleFund: Story = {
  args: {
    funds: sampleFunds.slice(0, 1),
  },
};

export const LongCopy: Story = {
  args: {
    funds: [
      {
        id: 'df-long',
        fundId: '3714200',
        name: 'Sailing Pavilion Dock Renovation Fund — capital improvements and accessibility updates for the waterfront facility used by varsity and recreational programs across MIT.',
        description:
          'Contributes to critical infrastructure upgrades and renovations for our historic sailing pavilion and docks, including phased dock replacement and accessibility improvements.',
        url: SAMPLE_DONATION_URL,
      },
    ],
  },
};
