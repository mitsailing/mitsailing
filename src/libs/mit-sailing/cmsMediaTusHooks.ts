import { verifyCmsMediaUploadToken } from '@/libs/mit-sailing/cmsMediaUploadTokens';

type CmsMediaTusUploadMetadata = {
  assetId: string;
  byteSize: number;
  filename: string;
  filetype: string;
  token: string;
};

export type CmsMediaTusHookAsset = {
  byteSize: bigint;
  id: string;
  mimeType: string;
  status: 'failed' | 'processing' | 'queued' | 'ready' | 'uploading';
  storageProvider: 'local' | 'server_folder';
  storedFilename: string;
};

type CmsMediaTusHookBody =
  | {
      ChangeFileInfo: {
        ID: string;
        Storage: {
          Path: string;
        };
      };
    }
  | {
      HTTPResponse: {
        Body: string;
        Header: Record<string, string>;
        StatusCode: number;
      };
      RejectUpload: true;
    }
  | Record<string, never>;

export type CmsMediaTusHookResult = {
  body: CmsMediaTusHookBody;
  status: number;
};

type ParsedPreCreateHook =
  | {
      metadata: CmsMediaTusUploadMetadata;
      size: number;
      type: 'pre-create';
    }
  | { type: 'ignored' }
  | { reason: 'invalid_metadata' | 'missing_token'; type: 'invalid' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objectField(
  value: unknown,
  field: string
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }
  const fieldValue = value[field];
  return isRecord(fieldValue) ? fieldValue : null;
}

function stringField(value: unknown, field: string): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const fieldValue = Reflect.get(value, field);
  return typeof fieldValue === 'string' && fieldValue.length > 0
    ? fieldValue
    : null;
}

function numberField(value: unknown, field: string): number | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const fieldValue = Reflect.get(value, field);
  return typeof fieldValue === 'number' && Number.isSafeInteger(fieldValue)
    ? fieldValue
    : null;
}

function parseMetadataByteSize(value: string | null): number | null {
  if (!value || !/^\d+$/u.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function rejectUpload(status: number, error: string): CmsMediaTusHookResult {
  return {
    body: {
      HTTPResponse: {
        Body: JSON.stringify({ error }),
        Header: {
          'Content-Type': 'application/json',
        },
        StatusCode: status,
      },
      RejectUpload: true,
    },
    status,
  };
}

function parsePreCreateHook(body: unknown): ParsedPreCreateHook {
  if (stringField(body, 'Type') !== 'pre-create') {
    return { type: 'ignored' };
  }
  const event = objectField(body, 'Event');
  const upload = event ? objectField(event, 'Upload') : null;
  const rawMetadata = upload ? objectField(upload, 'MetaData') : null;
  const size = upload ? numberField(upload, 'Size') : null;
  if (!rawMetadata || size === null) {
    return { reason: 'invalid_metadata', type: 'invalid' };
  }
  const token = stringField(rawMetadata, 'token');
  if (!token) {
    return { reason: 'missing_token', type: 'invalid' };
  }
  const assetId = stringField(rawMetadata, 'assetId');
  const filename = stringField(rawMetadata, 'filename');
  const filetype = stringField(rawMetadata, 'filetype');
  const byteSize = parseMetadataByteSize(stringField(rawMetadata, 'byteSize'));
  if (!assetId || !filename || !filetype || byteSize === null) {
    return { reason: 'invalid_metadata', type: 'invalid' };
  }
  return {
    metadata: {
      assetId,
      byteSize,
      filename,
      filetype,
      token,
    },
    size,
    type: 'pre-create',
  };
}

function tokenMatchesMetadata(props: {
  metadata: CmsMediaTusUploadMetadata;
  tokenPayload: {
    assetId: string;
    byteSize: number;
    mimeType: string;
    storedFilename: string;
  };
}): boolean {
  return (
    props.tokenPayload.assetId === props.metadata.assetId &&
    props.tokenPayload.byteSize === props.metadata.byteSize &&
    props.tokenPayload.mimeType === props.metadata.filetype &&
    props.tokenPayload.storedFilename === props.metadata.filename
  );
}

export async function handleCmsMediaTusHook(props: {
  body: unknown;
  findAsset: (assetId: string) => Promise<CmsMediaTusHookAsset | null>;
  now?: Date;
  secret: string;
}): Promise<CmsMediaTusHookResult> {
  const parsed = parsePreCreateHook(props.body);
  if (parsed.type === 'ignored') {
    return { body: {}, status: 200 };
  }
  if (parsed.type === 'invalid') {
    return rejectUpload(
      parsed.reason === 'missing_token' ? 401 : 400,
      parsed.reason
    );
  }
  const tokenPayload = verifyCmsMediaUploadToken({
    now: props.now,
    secret: props.secret,
    token: parsed.metadata.token,
  });
  if (!tokenPayload) {
    return rejectUpload(401, 'invalid_token');
  }
  if (
    !tokenMatchesMetadata({
      metadata: parsed.metadata,
      tokenPayload,
    })
  ) {
    return rejectUpload(403, 'token_metadata_mismatch');
  }
  const asset = await props.findAsset(parsed.metadata.assetId);
  if (!asset) {
    return rejectUpload(404, 'asset_not_found');
  }
  if (
    asset.storageProvider !== 'server_folder' ||
    asset.status !== 'uploading'
  ) {
    return rejectUpload(403, 'asset_not_uploading');
  }
  if (
    asset.byteSize !== BigInt(parsed.metadata.byteSize) ||
    parsed.size !== parsed.metadata.byteSize
  ) {
    return rejectUpload(400, 'byte_size_mismatch');
  }
  if (asset.mimeType !== parsed.metadata.filetype) {
    return rejectUpload(415, 'mime_type_mismatch');
  }
  if (asset.storedFilename !== parsed.metadata.filename) {
    return rejectUpload(400, 'filename_mismatch');
  }
  return {
    body: {
      ChangeFileInfo: {
        ID: asset.id,
        Storage: {
          Path: asset.id,
        },
      },
    },
    status: 200,
  };
}
