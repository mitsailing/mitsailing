import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EVENT_CATEGORY_CALENDAR_ACCENT_CLASS_NAME,
  resolveEventCategoryCalendarAccentClassName,
} from '@/lib/mit-sailing/eventCategoryAccent';

describe('resolveEventCategoryCalendarAccentClassName', () => {
  it('returns default when accent is absent', () => {
    expect(resolveEventCategoryCalendarAccentClassName({})).toBe(
      DEFAULT_EVENT_CATEGORY_CALENDAR_ACCENT_CLASS_NAME
    );
    expect(
      resolveEventCategoryCalendarAccentClassName({ accentClassName: null })
    ).toBe(DEFAULT_EVENT_CATEGORY_CALENDAR_ACCENT_CLASS_NAME);
  });

  it('returns default for blank stored class', () => {
    expect(
      resolveEventCategoryCalendarAccentClassName({ accentClassName: '   ' })
    ).toBe(DEFAULT_EVENT_CATEGORY_CALENDAR_ACCENT_CLASS_NAME);
  });

  it('trims stored class', () => {
    expect(
      resolveEventCategoryCalendarAccentClassName({
        accentClassName: ' bg-mit-success ',
      })
    ).toBe('bg-mit-success');
  });
});
