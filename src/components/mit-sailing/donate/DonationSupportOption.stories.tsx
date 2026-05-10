import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { HeartHandshake, Mail } from 'lucide-react';
import { DonationSupportOption } from './DonationSupportOption';

const meta = {
  title: 'MIT Sailing/Donate/SupportOption',
  component: DonationSupportOption,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Secondary callout on the donate page (mailing list, volunteer, etc.).',
      },
    },
  },
  args: {
    icon: Mail,
    title: 'Join our mailing list',
    body: 'Stay updated on regattas, pavilion events, and our competitive season.',
    linkLabel: 'Subscribe',
    linkHref: '/contact',
    linkExternal: false,
  },
  argTypes: {
    icon: { control: false },
    linkExternal: {
      description: 'Use true for external URLs (adds target=_blank and rel).',
    },
  },
} satisfies Meta<typeof DonationSupportOption>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MailingList: Story = {
  args: {
    icon: Mail,
  },
};

export const Volunteer: Story = {
  args: {
    icon: HeartHandshake,
    title: 'Volunteer with us',
    body: 'Become a mentor or race official to support our daily operations.',
    linkLabel: 'Learn more',
    linkHref: '/contact',
  },
};
