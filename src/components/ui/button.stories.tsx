import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ChevronRight } from 'lucide-react';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from './button';

const VARIANTS = [
  'default',
  'mit',
  'outline',
  'secondary',
  'ghost',
  'destructive',
  'link',
] as const;

const SIZES = [
  'default',
  'xs',
  'sm',
  'lg',
  'icon',
  'icon-xs',
  'icon-sm',
  'icon-lg',
] as const;

const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    children: 'Button',
    variant: 'default',
    size: 'default',
    disabled: false,
    type: 'button',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [...VARIANTS],
      description: 'Visual style variant (CVA `variant`).',
    },
    size: {
      control: 'select',
      options: [...SIZES],
      description: 'Height, padding, and icon scale (CVA `size`).',
    },
    asChild: {
      control: false,
      table: { disable: true },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = {
  args: { variant: 'outline' },
};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Ghost: Story = {
  args: { variant: 'ghost' },
};

export const Destructive: Story = {
  args: { variant: 'destructive' },
};

export const Link: Story = {
  args: { variant: 'link' },
};

/** Institute MIT red — use when `default` maps to neutral primary (e.g. dark theme). */
export const Mit: Story = {
  args: { variant: 'mit', children: 'Give now' },
};

export const SizeXs: Story = {
  args: { size: 'xs' },
};

export const SizeSm: Story = {
  args: { size: 'sm' },
};

export const SizeLg: Story = {
  args: { size: 'lg' },
};

export const SizeIcon: Story = {
  args: {
    size: 'icon',
    'aria-label': 'Next',
    children: <ChevronRight />,
  },
};

export const SizeIconXs: Story = {
  args: {
    size: 'icon-xs',
    'aria-label': 'Next',
    children: <ChevronRight />,
  },
};

export const SizeIconSm: Story = {
  args: {
    size: 'icon-sm',
    'aria-label': 'Next',
    children: <ChevronRight />,
  },
};

export const SizeIconLg: Story = {
  args: {
    size: 'icon-lg',
    'aria-label': 'Next',
    children: <ChevronRight />,
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const WithInteraction: Story = {
  args: { children: 'Press me' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Press me' });
    await expect(button).toBeEnabled();
    await userEvent.click(button);
    await expect(button).toBeVisible();
  },
};
