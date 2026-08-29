import type * as cmsMediaTusStatusModule from '@/libs/mit-sailing/cmsMediaTusStatus';

type GetCmsMediaTusUploadStatus =
  typeof cmsMediaTusStatusModule.getCmsMediaTusUploadStatus;

type TusUploadStatusResult = Awaited<ReturnType<GetCmsMediaTusUploadStatus>>;

function uploadHeaderNumber(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  if (!value || !/^\d+$/u.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function tusUploadStatusFromHeadResponse(
  response: Response,
  byteSize: number
): TusUploadStatusResult {
  if (response.status === 404) {
    return { complete: false, reason: 'upload_not_found' };
  }
  if (!response.ok) {
    return { complete: false, reason: 'upload_status_unavailable' };
  }
  const offset = uploadHeaderNumber(response.headers, 'Upload-Offset');
  const length = uploadHeaderNumber(response.headers, 'Upload-Length');
  if (offset === null || length === null) {
    return { complete: false, reason: 'missing_upload_headers' };
  }
  if (offset === byteSize && length === byteSize) {
    return { complete: true };
  }
  return { complete: false, reason: 'upload_incomplete' };
}

/**
 * Test double for tus HEAD status checks that mirrors production fetch behavior.
 *
 * @param props - Tus upload lookup inputs passed to the production helper.
 * @returns Parsed upload completion state from the mocked HEAD response.
 */
export async function mockTusUploadStatusFromFetch(
  props: Parameters<GetCmsMediaTusUploadStatus>[0]
): Promise<TusUploadStatusResult> {
  try {
    const response = await fetch(
      `${props.baseUrl.replace(/\/$/u, '')}/cms-media/uploads/${encodeURIComponent(
        props.assetId
      )}`,
      {
        method: 'HEAD',
        signal: AbortSignal.timeout(props.timeoutMs ?? 5000),
      }
    );
    return tusUploadStatusFromHeadResponse(response, props.byteSize);
  } catch {
    return { complete: false, reason: 'upload_status_unavailable' };
  }
}
