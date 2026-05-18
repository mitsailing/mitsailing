const CMS_MEDIA_TUS_HEAD_TIMEOUT_MS = 5000;

export type CmsMediaTusUploadStatus =
  | { complete: true }
  | {
      complete: false;
      reason:
        | 'missing_upload_headers'
        | 'upload_incomplete'
        | 'upload_not_found'
        | 'upload_status_unavailable';
    };

function buildCmsMediaTusUploadUrl(props: {
  assetId: string;
  baseUrl: string;
}): string {
  return `${props.baseUrl.replace(/\/$/u, '')}/cms-media/uploads/${encodeURIComponent(
    props.assetId
  )}`;
}

function uploadHeaderNumber(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  if (!value || !/^\d+$/u.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function getCmsMediaTusUploadStatus(props: {
  assetId: string;
  baseUrl: string;
  byteSize: number;
  timeoutMs?: number;
}): Promise<CmsMediaTusUploadStatus> {
  let response: Response;
  try {
    response = await fetch(
      buildCmsMediaTusUploadUrl({
        assetId: props.assetId,
        baseUrl: props.baseUrl,
      }),
      {
        method: 'HEAD',
        signal: AbortSignal.timeout(
          props.timeoutMs ?? CMS_MEDIA_TUS_HEAD_TIMEOUT_MS
        ),
      }
    );
  } catch {
    return { complete: false, reason: 'upload_status_unavailable' };
  }
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
  if (offset === props.byteSize && length === props.byteSize) {
    return { complete: true };
  }
  return { complete: false, reason: 'upload_incomplete' };
}
