import { describe, expect, it, vi } from 'vitest';
import { seedEvents } from '../../../prisma/seedMitSailing/steps';
import type { PrismaClient } from '../../generated/prisma/client';
import { EVENTS } from './eventsSeed';

type EventUpsertArgs = Parameters<PrismaClient['event']['upsert']>[0];

describe('seedEvents', () => {
  it('preserves admin-managed registration fields when seed rows omit them', async () => {
    const upsertCalls: EventUpsertArgs[] = [];
    const eventUpsert = vi.fn(async (args: EventUpsertArgs) => {
      upsertCalls.push(args);
      await Promise.resolve();
      return {};
    });
    const prisma = {
      event: {
        upsert: eventUpsert,
      },
    };
    const eventWithoutManagedRegistration = EVENTS.find(
      (event) =>
        event.registration_mode === undefined &&
        event.learn_to_sail_managed_class_kind === undefined &&
        event.selection_note === undefined
    );

    expect(eventWithoutManagedRegistration).toBeDefined();

    await seedEvents(prisma);

    const upsertArgs = upsertCalls.find(
      (call) => call.where.id === eventWithoutManagedRegistration?.id
    );
    if (!upsertArgs) {
      throw new TypeError('Expected seed event upsert call to be captured.');
    }

    expect(upsertArgs.create).toMatchObject({
      learnToSailManagedClassKind: 'none',
      registrationMode: 'standard',
      selectionNote: null,
    });
    expect(upsertArgs.update).not.toHaveProperty('registrationMode');
    expect(upsertArgs.update).not.toHaveProperty('learnToSailManagedClassKind');
    expect(upsertArgs.update).not.toHaveProperty('selectionNote');
  });
});
