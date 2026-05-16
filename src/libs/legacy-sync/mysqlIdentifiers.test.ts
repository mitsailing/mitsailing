import { describe, expect, it } from 'vitest';
import { quoteMysqlIdentifier } from '@/libs/legacy-sync/mysqlIdentifiers';

describe('quoteMysqlIdentifier', () => {
  it('quotes mysql identifiers with embedded backticks', () => {
    expect(quoteMysqlIdentifier('odd`name')).toBe('`odd``name`');
  });
});
