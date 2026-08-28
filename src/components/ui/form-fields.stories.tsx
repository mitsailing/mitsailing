import { Description, Field, Label as HeadlessLabel } from '@headlessui/react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { Input } from './input';
import { Label } from './label';
import { NativeSelect } from './native-select';
import { Textarea } from './textarea';

/**
 * Canonical form chrome: Headless UI Field + Label with shadcn Input controls.
 * Invalid: `aria-invalid` on the control (Input already styles destructive border/ring).
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
      <Field className="flex flex-col gap-1.5">
        <HeadlessLabel className="text-sm font-medium" htmlFor="story-name">
          Name
        </HeadlessLabel>
        <Input id="story-name" name="name" placeholder="Jane Doe" />
      </Field>
      <Field className="flex flex-col gap-1.5">
        <HeadlessLabel className="text-sm font-medium" htmlFor="story-role">
          Role
        </HeadlessLabel>
        <NativeSelect defaultValue="" id="story-role" name="role">
          <option disabled value="">
            Select a role
          </option>
          <option value="member">Member</option>
          <option value="volunteer">Volunteer</option>
        </NativeSelect>
      </Field>
      <Field className="flex flex-col gap-1.5">
        <HeadlessLabel className="text-sm font-medium" htmlFor="story-notes">
          Notes
        </HeadlessLabel>
        <Textarea
          id="story-notes"
          name="notes"
          placeholder="Optional details"
        />
        <Description className="text-xs text-muted-foreground">
          Optional details for staff.
        </Description>
      </Field>
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
      <Field className="flex flex-col gap-1.5">
        <HeadlessLabel
          className="text-sm font-medium text-mit-red-600"
          htmlFor="story-invalid-email"
        >
          Email
        </HeadlessLabel>
        <Input
          aria-invalid
          defaultValue="not-an-email"
          id="story-invalid-email"
          type="email"
        />
      </Field>
      <Field className="flex flex-col gap-1.5">
        <HeadlessLabel
          className="text-sm font-medium text-mit-red-600"
          htmlFor="story-invalid-role"
        >
          Role
        </HeadlessLabel>
        <NativeSelect aria-invalid defaultValue="" id="story-invalid-role">
          <option value="">Required</option>
          <option value="member">Member</option>
        </NativeSelect>
      </Field>
      <Field className="flex flex-col gap-1.5">
        <HeadlessLabel
          className="text-sm font-medium text-mit-red-600"
          htmlFor="story-invalid-notes"
        >
          Notes
        </HeadlessLabel>
        <Textarea aria-invalid id="story-invalid-notes" />
      </Field>
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
