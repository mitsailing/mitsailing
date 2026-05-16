import { describe, expect, it, vi } from 'vitest';
import { updatePavilionReservationAdminAction } from '@/libs/admin/pavilion-reservations/pavilionReservationAdminActions';

const { requireAdmin } = vi.hoisted(() => ({
  requireAdmin: vi.fn(() => ({ user: { id: 'user-1' } })),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/auth/dal', () => ({
  requireAdmin,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('updatePavilionReservationAdminAction', () => {
  it('throws with missing required field names when workflow fields are absent', async () => {
    await expect(
      updatePavilionReservationAdminAction('en', 'req-1', new FormData())
    ).rejects.toThrow(
      'Missing required fields: workflowStatus, paymentStatus, persona'
    );
  });

  it('throws listing only invalid workflow fields', async () => {
    const formData = new FormData();
    formData.set('workflowStatus', 'pending');
    formData.set('paymentStatus', 'unpaid');
    formData.set('persona', 'not-a-persona');

    await expect(
      updatePavilionReservationAdminAction('en', 'req-1', formData)
    ).rejects.toThrow('Missing required fields: persona');
  });
});
