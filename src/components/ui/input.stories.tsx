import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Input } from './input';
import { Label } from './label';

const meta = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex w-full max-w-xs flex-col gap-1.5">
      <Label htmlFor="story-email">Email</Label>
      <Input id="story-email" placeholder="you@example.com" type="email" />
    </div>
  ),
};
