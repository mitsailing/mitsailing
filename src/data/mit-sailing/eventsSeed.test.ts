import { describe, expect, it } from 'vitest';
import {
  EVENT_REGISTRATIONS,
  EVENTS,
  GLOBAL_EVENT_DATES,
  STUB_USERS,
} from './eventsSeed';

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

  it('keeps every Learn-to-Sail weekday priority cohort managed and approval based', () => {
    const weekdayEvents = EVENTS.filter((event) =>
      event.id.startsWith('evt-lts-weekday-')
    );

    expect(weekdayEvents).toHaveLength(3);
    for (const event of weekdayEvents) {
      expect(event.requires_approval).toBe(true);
      expect(event.learn_to_sail_managed_class_kind).toBe(
        'beginner_mid_week_123'
      );
      expect(event.selection_note).toBe('Decisions Monday afternoon');
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
    expect(
      weekdayDates.map((date) => date.start_datetime.slice(0, 10))
    ).toEqual([
      '2026-04-14',
      '2026-04-15',
      '2026-04-16',
      '2026-04-21',
      '2026-04-22',
      '2026-04-23',
      '2026-05-05',
      '2026-05-06',
      '2026-05-07',
    ]);
    for (const date of weekdayDates) {
      expect(date.start_datetime.slice(11, 16)).toBe('21:30');
      expect(date.end_datetime.slice(11, 16)).toBe('23:30');
    }
  });

  it('keeps Learn-to-Sail weekday descriptions close to legacy HTML', () => {
    const weekdayEvents = EVENTS.filter((event) =>
      event.id.startsWith('evt-lts-weekday-')
    );

    expect(weekdayEvents).toHaveLength(3);
    expect(weekdayEvents.map((event) => event.slug)).toEqual([
      'learn-to-sail-weekday-apr-14',
      'learn-to-sail-weekday-apr-21',
      'learn-to-sail-weekday-may-5',
    ]);
    expect(weekdayEvents[0]?.description).toContain(
      '<p>This three-day <em><strong>beginner</strong></em> course'
    );
    expect(weekdayEvents[0]?.description).toContain('Tuesday, Apr 14th');
    expect(weekdayEvents[0]?.description).toContain('Monday, Apr 13th');
    expect(weekdayEvents[1]?.description).toContain('Tuesday, Apr 21st');
    expect(weekdayEvents[1]?.description).toContain('Thursday, Apr&nbsp;23rd');
    expect(weekdayEvents[2]?.description).toContain('Tuesday, May 5th');
    expect(weekdayEvents[2]?.description).toContain('Monday, May 4th');
    for (const event of weekdayEvents) {
      expect(event.description).toContain('Midnight (12:00:01 am) to 10 am');
      expect(event.description).not.toContain('Midnight (00:00:01 am)');
      expect(event.description).not.toContain(
        'Three consecutive afternoon sessions'
      );
      expect(event.description).not.toContain('LTS Weekday');
    }
  });

  it('keeps Learn-to-Sail weekday request windows close to legacy rows', () => {
    const expectedWindows = new Map([
      [
        'evt-lts-weekday-apr-14',
        {
          end: '2026-04-13T14:00:00.000Z',
          start: '2026-04-13T04:00:01.000Z',
        },
      ],
      [
        'evt-lts-weekday-apr-21',
        {
          end: '2026-04-20T14:00:00.000Z',
          start: '2026-04-20T04:00:01.000Z',
        },
      ],
      [
        'evt-lts-weekday-may-5',
        {
          end: '2026-05-04T14:00:00.000Z',
          start: '2026-05-04T04:00:01.000Z',
        },
      ],
    ]);

    for (const [eventId, window] of expectedWindows) {
      const event = EVENTS.find((candidate) => candidate.id === eventId);
      const registrations = EVENT_REGISTRATIONS.filter(
        (registration) => registration.event_id === eventId
      );

      expect(event).toMatchObject({
        registration_end: window.end,
        registration_start: window.start,
      });
      for (const registration of registrations) {
        expect(registration.created_at >= window.start).toBe(true);
        expect(registration.created_at <= window.end).toBe(true);
      }
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
