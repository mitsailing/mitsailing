import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';

/**
 * Composed example: shadcn form chrome (`Label` + `Input`) with MIT CTA (`Button variant="mit"`).
 * Toggle dark in Storybook toolbar to see neutral `default` vs institute red `mit`.
 */
const meta = {
  title: 'UI/Form fields',
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const AuthStyleFields: Story = {
  render: () => (
    <form className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-foreground" htmlFor="story-password">
          Password
        </Label>
        <Input
          autoComplete="current-password"
          id="story-password"
          type="password"
        />
      </div>
      <Button className="w-full" type="button" variant="mit">
        Sign in
      </Button>
    </form>
  ),
};
