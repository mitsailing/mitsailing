import { describe, expect, it } from 'vitest';
import { EVENTS, GLOBAL_EVENT_DATES, STUB_USERS } from './eventsSeed';

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
      (event) =>
        event.learn_to_sail_managed_class_kind !== undefined &&
        event.learn_to_sail_managed_class_kind !== 'none'
    );

    expect(managedEvents).not.toHaveLength(0);
    for (const event of managedEvents) {
      expect(event.registration_mode ?? 'standard').toBe('standard');
      expect(event.requires_approval).toBe(true);
    }
  });

  it('keeps Learn-to-Sail labels close to legacy event rows', () => {
    const weekdayEvents = EVENTS.filter((event) =>
      event.id.startsWith('evt-lts-weekday-')
    );
    const allInOneEvent = EVENTS.find(
      (event) => event.id === 'evt-lts-allinone'
    );

    expect(allInOneEvent).toMatchObject({
      name: 'Learn to Sail Class - All-in-One',
      short_name: 'Learn-to-Sail All-in-One',
    });
    expect(weekdayEvents).toHaveLength(3);
    for (const event of weekdayEvents) {
      expect(event.name).toBe(
        'Learn to Sail Class - Tech Dinghy for Beginners'
      );
      expect(event.short_name).toBe('Learn-to-Sail Class 1-2-3');
      expect(event.name).not.toMatch(/\b[A-Z][a-z]{2} \d/u);
      expect(event.short_name).not.toMatch(/\b[A-Z][a-z]{2} \d/u);
    }
  });

  it('keeps Learn-to-Sail weekday times close to legacy date rows', () => {
    const weekdayDates = GLOBAL_EVENT_DATES.filter((date) =>
      date.eventId.startsWith('evt-lts-weekday-')
    );

    expect(weekdayDates).toHaveLength(9);
    for (const date of weekdayDates) {
      expect(date.start_datetime.slice(11, 16)).toBe('21:30');
      expect(date.end_datetime.slice(11, 16)).toBe('23:30');
    }
  });

  it('keeps Learn-to-Sail All-in-One times close to legacy date rows', () => {
    const allInOneDates = GLOBAL_EVENT_DATES.filter(
      (date) => date.eventId === 'evt-lts-allinone'
    );

    expect(allInOneDates).toHaveLength(3);
    for (const date of allInOneDates) {
      expect(date.start_datetime.slice(11, 16)).toBe('13:45');
      expect(date.end_datetime.slice(11, 16)).toBe('19:30');
    }
  });
});
