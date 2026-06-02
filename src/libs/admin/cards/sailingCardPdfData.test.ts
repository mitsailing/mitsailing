import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSailingCardPdfAssets } from './sailingCardPdfData';

vi.mock('server-only', () => ({}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

const mockedReadFile = vi.mocked(readFile);

beforeEach(() => {
  mockedReadFile.mockReset();
});

describe('loadSailingCardPdfAssets', () => {
  it('retries asset reads after an initial failure', async () => {
    const error = new Error('missing burgee');
    mockedReadFile
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(Buffer.from([9]))
      .mockResolvedValueOnce(Buffer.from([1]))
      .mockResolvedValueOnce(Buffer.from([2]));

    await expect(loadSailingCardPdfAssets()).rejects.toThrow(error);

    await expect(loadSailingCardPdfAssets()).resolves.toEqual({
      burgee: Buffer.from([1]),
      mit: Buffer.from([2]),
    });
    expect(mockedReadFile).toHaveBeenCalledTimes(4);
  });
});
