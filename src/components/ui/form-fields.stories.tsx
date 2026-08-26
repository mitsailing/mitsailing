import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { Input } from './input';
import { Label } from './label';
import { NativeSelect } from './native-select';
import { Textarea } from './textarea';

/**
 * Canonical form chrome: shadcn `Label` + native controls with shared Tailwind tokens.
 * Toggle dark in Storybook toolbar to verify focus rings and select chevrons.
 */
const meta = {
  title: 'UI/Form fields',
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllFieldTypes: Story = {
  render: () => (
    <form className="flex w-full max-w-sm flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="story-name">Name</Label>
        <Input id="story-name" name="name" placeholder="Jane Doe" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="story-role">Role</Label>
        <NativeSelect defaultValue="" id="story-role" name="role">
          <option disabled value="">
            Select a role
          </option>
          <option value="member">Member</option>
          <option value="volunteer">Volunteer</option>
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="story-notes">Notes</Label>
        <Textarea
          id="story-notes"
          name="notes"
          placeholder="Optional details"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="story-agree">Terms</Label>
        <label
          className="flex cursor-pointer items-start gap-2 text-sm"
          htmlFor="story-agree"
        >
          <Checkbox
            className="mt-0.5"
            defaultChecked
            id="story-agree"
            name="agree"
          />
          <span>I agree to the program terms</span>
        </label>
      </div>
      <Button className="w-full" type="button" variant="mit">
        Save
      </Button>
    </form>
  ),
};

export const InvalidStates: Story = {
  render: () => (
    <form className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="story-invalid-email">Email</Label>
        <Input
          aria-invalid
          defaultValue="not-an-email"
          id="story-invalid-email"
          type="email"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="story-invalid-role">Role</Label>
        <NativeSelect aria-invalid defaultValue="" id="story-invalid-role">
          <option value="">Required</option>
          <option value="member">Member</option>
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="story-invalid-notes">Notes</Label>
        <Textarea aria-invalid id="story-invalid-notes" />
      </div>
    </form>
  ),
};

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
