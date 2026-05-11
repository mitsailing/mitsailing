import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CreditCard, Plus, Save } from 'lucide-react';
import {
  AdminEventCheckbox,
  AdminEventEmptyState,
  AdminEventField,
  AdminEventFormSection,
} from '@/components/mit-sailing/admin/events/AdminEventShared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const meta = {
  title: 'MIT Sailing/Admin/Event panels',
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const EventEditorPanels: Story = {
  render: () => (
    <div className="flex max-w-4xl flex-col gap-5">
      <AdminEventFormSection
        subtitle="Core event copy, publishing, registration window, and capacity."
        title="Basics"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <AdminEventField htmlFor="story-event-name" label="Event name">
            <Input
              defaultValue="Bluewater shakedown sail"
              id="story-event-name"
            />
          </AdminEventField>
          <AdminEventField htmlFor="story-event-slug" label="Slug">
            <Input
              defaultValue="bluewater-shakedown-sail"
              id="story-event-slug"
            />
          </AdminEventField>
        </div>
        <AdminEventField htmlFor="story-event-description" label="Description">
          <Textarea
            className="min-h-24"
            defaultValue="A focused prep sail for members joining the coastal passage program."
            id="story-event-description"
          />
        </AdminEventField>
        <div className="grid gap-4 md:grid-cols-2">
          <AdminEventCheckbox
            defaultChecked
            label="Published on the public calendar"
            name="story-published"
          />
          <AdminEventCheckbox
            defaultChecked
            label="Require manual approval"
            name="story-approval"
          />
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="mit">
            <Save aria-hidden className="size-4" />
            Save event details
          </Button>
        </div>
      </AdminEventFormSection>

      <AdminEventFormSection
        subtitle="Each row is an independent occurrence."
        title="Dates and times"
      >
        <div className="grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <AdminEventField htmlFor="story-date-start" label="Starts">
            <Input
              defaultValue="2026-05-16T09:00"
              id="story-date-start"
              type="datetime-local"
            />
          </AdminEventField>
          <AdminEventField htmlFor="story-date-end" label="Ends">
            <Input
              defaultValue="2026-05-16T17:00"
              id="story-date-end"
              type="datetime-local"
            />
          </AdminEventField>
          <Button type="button" variant="outline">
            Save
          </Button>
        </div>
        <Button className="w-fit" type="button" variant="mit">
          <Plus aria-hidden className="size-4" />
          Add date
        </Button>
      </AdminEventFormSection>

      <AdminEventFormSection
        subtitle="Stripe checkout attaches here once payment audit records exist."
        title="Payments"
      >
        <AdminEventEmptyState>
          <span className="inline-flex items-center gap-2">
            <CreditCard aria-hidden className="size-4" />
            Payment configuration placeholder
          </span>
        </AdminEventEmptyState>
      </AdminEventFormSection>
    </div>
  ),
};
