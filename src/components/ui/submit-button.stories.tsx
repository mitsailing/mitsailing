import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { SubmitButton } from './submit-button';

const meta = {
  title: 'UI/SubmitButton',
  component: SubmitButton,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    children: 'Save',
    pendingLabel: 'Saving...',
    type: 'submit',
    variant: 'mit',
  },
} satisfies Meta<typeof SubmitButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PendingSave: Story = {
  args: {
    pending: true,
    pendingLabel: 'Saving...',
  },
};

export const PendingDestructiveDelete: Story = {
  args: {
    children: 'Delete',
    pending: true,
    pendingLabel: 'Deleting...',
    variant: 'destructive',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const BusyAccessibleName: Story = {
  args: {
    children: 'Submit',
    pending: true,
    pendingLabel: 'Submitting...',
  },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Submitting...' });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).toHaveAccessibleDescription('Submitting...');
    await expect(button).toHaveAttribute('title', 'Submitting...');
  },
};
