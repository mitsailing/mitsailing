import * as tus from 'tus-js-client';

const retryDelays = [0, 3000, 5000, 10_000, 20_000];

export type CmsMediaTusUploadSession = {
  byteSize: number;
  endpoint: string;
  expiresAt: string;
  headers: Record<string, string>;
  metadata: {
    assetId: string;
    byteSize: string;
    filename: string;
    filetype: string;
    token: string;
  };
  protocol: 'tus';
};

export type CmsMediaTusUploadResult = {
  assetId: string;
};

type CmsMediaTusPreviousUpload = Awaited<
  ReturnType<InstanceType<typeof tus.Upload>['findPreviousUploads']>
>[number];

function previousUploadTime(previousUpload: CmsMediaTusPreviousUpload): number {
  if (!previousUpload.creationTime) {
    return 0;
  }
  const time = Date.parse(previousUpload.creationTime);
  return Number.isFinite(time) ? time : 0;
}

function previousUploadAssetId(
  previousUpload: CmsMediaTusPreviousUpload
): string | undefined {
  const { metadata } = previousUpload;
  const { assetId } = metadata;
  return typeof assetId === 'string' && assetId.length > 0
    ? assetId
    : undefined;
}

function newestPreviousUpload(
  previousUploads: CmsMediaTusPreviousUpload[]
): CmsMediaTusPreviousUpload | null {
  return (
    previousUploads
      .filter((previousUpload) => previousUploadAssetId(previousUpload))
      .toSorted(
        (left, right) => previousUploadTime(right) - previousUploadTime(left)
      )[0] ?? null
  );
}

export async function uploadCmsMediaWithTus(props: {
  file: File;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  session: CmsMediaTusUploadSession;
}): Promise<CmsMediaTusUploadResult> {
  let resumedAssetId: string | undefined;
  const uploadDeferred = Promise.withResolvers<CmsMediaTusUploadResult>();

  const upload = new tus.Upload(props.file, {
    endpoint: props.session.endpoint,
    headers: props.session.headers,
    metadata: props.session.metadata,
    onError: uploadDeferred.reject,
    onProgress: props.onProgress,
    onSuccess: () => {
      uploadDeferred.resolve({
        assetId: resumedAssetId ?? props.session.metadata.assetId,
      });
    },
    removeFingerprintOnSuccess: true,
    retryDelays,
    uploadSize: props.session.byteSize,
  });

  try {
    const previousUploads = await upload.findPreviousUploads();
    const previousUpload = newestPreviousUpload(previousUploads);
    if (previousUpload) {
      resumedAssetId = previousUploadAssetId(previousUpload);
      upload.resumeFromPreviousUpload(previousUpload);
    }
    upload.start();
  } catch (error: unknown) {
    uploadDeferred.reject(error);
  }

  return uploadDeferred.promise;
}
