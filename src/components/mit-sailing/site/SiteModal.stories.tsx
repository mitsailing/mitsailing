import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { SiteModalContent } from './SiteModal';

function SiteModalExample() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="mit">
          Open modal
        </Button>
      </DialogTrigger>
      <SiteModalContent
        closeLabel="Close modal"
        eyebrow="MIT Sailing"
        title="Modal title"
      >
        <p className="text-sm leading-6 text-muted-foreground">
          Reusable modal body content with the shared MIT Sailing header, close
          button, responsive sizing, and scroll container.
        </p>
      </SiteModalContent>
    </Dialog>
  );
}

const meta = {
  title: 'MIT Sailing/SiteModal',
  component: SiteModalExample,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof SiteModalExample>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open modal' }));

    const dialog = await within(document.body).findByRole('dialog', {
      name: 'Modal title',
    });
    await expect(dialog).toBeVisible();
    await expect(
      within(dialog).getByRole('button', { name: 'Close modal' })
    ).toBeVisible();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Close modal' })
    );
    await expect(dialog).toHaveAttribute('data-state', 'closed');
  },
};
