import { describe, expect, it } from 'vitest';
import {
  deriveHomeSailPathExperiencedSchedule,
  formatHomeSailPathExperiencedSession,
  homeSailPathExperiencedEventName,
  homeSailPathSignupHref,
} from '@/libs/mit-sailing/homeSailPathSchedule';

describe('homeSailPathSchedule', () => {
  it('names the introduction for experienced sailors event', () => {
    expect(homeSailPathExperiencedEventName()).toBe(
      'Introduction for Experienced Sailors'
    );
  });

  it('returns the signup path that resumes on the home waitlist', () => {
    expect(homeSailPathSignupHref()).toBe('/signup?callbackUrl=%2F');
  });

  it('formats an experienced session date link', () => {
    expect(
      formatHomeSailPathExperiencedSession({
        eventSlug: 'intro-experienced-sep-29',
        id: 'date-1',
        startDateTime: new Date('2026-09-29T21:00:00.000Z'),
      })
    ).toEqual({
      dateLabel: 'Tue, Sep 29',
      href: '/events/intro-experienced-sep-29',
      id: 'date-1',
    });
  });

  it('derives a shared tuesday schedule when sessions agree', () => {
    expect(
      deriveHomeSailPathExperiencedSchedule([
        {
          startDateTime: new Date('2026-09-29T21:00:00.000Z'),
          endDateTime: new Date('2026-09-29T22:30:00.000Z'),
        },
        {
          startDateTime: new Date('2026-10-06T21:00:00.000Z'),
          endDateTime: new Date('2026-10-06T22:30:00.000Z'),
        },
      ])
    ).toEqual({
      durationMinutes: 90,
      time: '5:00 PM',
      weekdayPlural: 'Tuesdays',
    });
  });

  it('returns null when weekday or start time differs', () => {
    expect(
      deriveHomeSailPathExperiencedSchedule([
        {
          startDateTime: new Date('2026-09-29T21:00:00.000Z'),
          endDateTime: new Date('2026-09-29T22:30:00.000Z'),
        },
        {
          startDateTime: new Date('2026-10-07T21:00:00.000Z'),
          endDateTime: new Date('2026-10-07T22:30:00.000Z'),
        },
      ])
    ).toBeNull();
  });
});
