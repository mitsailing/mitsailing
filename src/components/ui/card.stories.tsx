import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './card';

const meta = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Project overview</CardTitle>
        <CardDescription>
          Track progress and recent activity for your Next.js app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        Your design system is ready. Start building your next component.
      </CardContent>
    </Card>
  ),
};
