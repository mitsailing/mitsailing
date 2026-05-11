/**
 * Calendar (and related) category accent bars use a Tailwind background utility.
 * Prefer `accent_class_name` on `event_categories`; when unset or blank,
 * callers receive {@link DEFAULT_EVENT_CATEGORY_CALENDAR_ACCENT_CLASS_NAME}.
 */
export const DEFAULT_EVENT_CATEGORY_CALENDAR_ACCENT_CLASS_NAME = 'bg-mit-cat';

/**
 * @param category - Category row fields (typically from Prisma `accent_class_name`)
 * @returns Tailwind `bg-*` class for the narrow category bar
 */
export function resolveEventCategoryCalendarAccentClassName(category: {
  accentClassName?: string | null;
}): string {
  const fromModel = category.accentClassName?.trim();
  if (fromModel) {
    return fromModel;
  }
  return DEFAULT_EVENT_CATEGORY_CALENDAR_ACCENT_CLASS_NAME;
}
