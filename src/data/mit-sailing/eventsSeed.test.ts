import { describe, expect, it } from 'vitest';
import { EVENTS, STUB_USERS } from './eventsSeed';

describe('eventsSeed', () => {
  it('sets username initials from name', () => {
    const user = STUB_USERS.find((stubUser) => stubUser.id === 'username');

    expect(user).toMatchObject({
      name: 'Username',
      initials: 'U',
    });
  });

  it('keeps Learn-to-Sail managed rows approval based', () => {
    const managedEvents = EVENTS.filter(
      (event) => event.learn_to_sail_managed_class_kind !== undefined
    );

    expect(managedEvents).not.toHaveLength(0);
    for (const event of managedEvents) {
      expect(event.registration_mode ?? 'standard').toBe('standard');
      expect(event.requires_approval).toBe(true);
    }
  });
});
