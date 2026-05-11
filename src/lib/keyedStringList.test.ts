import { describe, expect, it } from 'vitest';
import { keyedOccurrences, keyedStringItems } from './keyedStringList';

describe('keyedOccurrences', () => {
  it('returns empty for empty input', () => {
    expect(keyedOccurrences([], () => '')).toEqual([]);
  });

  it('keys by keyOf with zero-based occurrence suffix', () => {
    expect(
      keyedOccurrences(
        [
          { id: 1, label: 'a' },
          { id: 2, label: 'b' },
        ],
        (row: { id: number; label: string }) => row.label
      )
    ).toEqual([
      { key: 'a-0', item: { id: 1, label: 'a' } },
      { key: 'b-0', item: { id: 2, label: 'b' } },
    ]);
  });

  it('suffixes duplicate keyOf strings so keys stay unique', () => {
    expect(keyedOccurrences(['x', 'x', 'y', 'x'], (v) => v)).toEqual([
      { key: 'x-0', item: 'x' },
      { key: 'x-1', item: 'x' },
      { key: 'y-0', item: 'y' },
      { key: 'x-2', item: 'x' },
    ]);
  });
});

describe('keyedStringItems', () => {
  it('returns empty for empty input', () => {
    expect(keyedStringItems([])).toEqual([]);
  });

  it('assigns key from value and zero index when all unique', () => {
    expect(keyedStringItems(['a', 'b'])).toEqual([
      { key: 'a-0', value: 'a' },
      { key: 'b-0', value: 'b' },
    ]);
  });

  it('suffixes occurrence so duplicate values get distinct keys', () => {
    expect(keyedStringItems(['x', 'x', 'y', 'x'])).toEqual([
      { key: 'x-0', value: 'x' },
      { key: 'x-1', value: 'x' },
      { key: 'y-0', value: 'y' },
      { key: 'x-2', value: 'x' },
    ]);
  });
});
