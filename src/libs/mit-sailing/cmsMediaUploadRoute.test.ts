import { describe, expect, it } from 'vitest';
import {
  isFinalizeIdempotentSuccessStatus,
  isUploadCancelIdempotentSuccess,
} from '@/libs/mit-sailing/cmsMediaUploadRoute';

function asset(
  status: 'failed' | 'processing' | 'queued' | 'ready' | 'uploading',
  processingErrorCode: string | null = null
) {
  return {
    byteSize: BigInt(Number.parseInt('1024', 10)),
    createdAt: new Date(Date.UTC(2026, 4, 17, 12)),
    id: 'asset-1',
    mediaKind: 'image' as const,
    mimeType: 'image/png',
    originalFilename: 'Race Day.png',
    processingErrorCode,
    publicPath: '/cms-media/asset-1/race-day.png',
    status,
    storageProvider: 'server_folder' as const,
  };
}

describe('cmsMediaUploadRoute helpers', () => {
  it('treats only processing and ready as finalize idempotent success', () => {
    expect(isFinalizeIdempotentSuccessStatus('queued')).toBe(false);
    expect(isFinalizeIdempotentSuccessStatus('processing')).toBe(true);
    expect(isFinalizeIdempotentSuccessStatus('ready')).toBe(true);
    expect(isFinalizeIdempotentSuccessStatus('uploading')).toBe(false);
    expect(isFinalizeIdempotentSuccessStatus('failed')).toBe(false);
  });

  it('treats upload_cancelled failed assets as cancel idempotent success', () => {
    expect(
      isUploadCancelIdempotentSuccess(asset('failed', 'upload_cancelled'))
    ).toBe(true);
    expect(isUploadCancelIdempotentSuccess(asset('failed', 'other'))).toBe(
      false
    );
    expect(isUploadCancelIdempotentSuccess(asset('uploading'))).toBe(false);
  });
});
