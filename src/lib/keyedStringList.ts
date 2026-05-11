/**
 * Row for rendering lists where duplicates need stable distinct React keys.
 */
export type KeyedOccurrence<T> = {
  key: string;
  item: T;
};

/**
 * Maps each item to a unique `key` among siblings by counting occurrences of
 * `keyOf(item)` in order (first occurrence suffix `0`, then `1`, …).
 *
 * @param items - Ordered values (e.g. plans or lines)
 * @param keyOf - Stable string key for an item (e.g. title or the string itself)
 * @returns Same length as `items`, keys unique for this snapshot
 */
export function keyedOccurrences<T>(
  items: readonly T[],
  keyOf: (item: T) => string
): KeyedOccurrence<T>[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const raw = keyOf(item);
    const count = seen.get(raw) ?? 0;
    seen.set(raw, count + 1);
    return { key: `${raw}-${count}`, item };
  });
}

/**
 * Row for rendering string lists where duplicates need stable distinct React keys.
 */
export type KeyedStringItem = {
  key: string;
  value: string;
};

/**
 * Maps each string to a unique `key` among siblings (by occurrence index) and the
 * original `value`, for `key` + display or `Image` `src` when items may repeat.
 *
 * @param values - Ordered strings (e.g. address lines or image URLs)
 * @returns Same length as `values`, keys unique for this snapshot
 */
export function keyedStringItems(values: readonly string[]): KeyedStringItem[] {
  return keyedOccurrences(values, (value) => value).map((entry) => ({
    key: entry.key,
    value: entry.item,
  }));
}
