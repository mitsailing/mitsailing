import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadCmsMediaWithTus } from '@/components/mit-sailing/admin/catalog/cmsMediaTusUpload';

type MockTusPreviousUpload = {
  creationTime?: string;
  metadata?: Record<string, string>;
  uploadUrl: string;
};

type MockTusUploadOptions = {
  endpoint: string;
  headers: Record<string, string>;
  metadata: Record<string, string>;
  onError: (error: Error) => void;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  onSuccess: () => void;
  removeFingerprintOnSuccess: boolean;
  retryDelays: number[];
  uploadSize: number;
};

type MockTusUploadInstance = {
  file: File;
  findPreviousUploads: ReturnType<
    typeof vi.fn<() => Promise<MockTusPreviousUpload[]>>
  >;
  options: MockTusUploadOptions;
  resumeFromPreviousUpload: ReturnType<
    typeof vi.fn<(previousUpload: MockTusPreviousUpload) => void>
  >;
  start: ReturnType<typeof vi.fn<() => void>>;
};

const tusMocks = vi.hoisted(() => {
  type PreviousUpload = {
    creationTime?: string;
    metadata?: Record<string, string>;
    uploadUrl: string;
  };
  type UploadOptions = {
    endpoint: string;
    headers: Record<string, string>;
    metadata: Record<string, string>;
    onError: (error: Error) => void;
    onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
    onSuccess: () => void;
    removeFingerprintOnSuccess: boolean;
    retryDelays: number[];
    uploadSize: number;
  };
  type UploadInstance = {
    file: File;
    findPreviousUploads: ReturnType<
      typeof vi.fn<() => Promise<PreviousUpload[]>>
    >;
    options: UploadOptions;
    resumeFromPreviousUpload: ReturnType<
      typeof vi.fn<(previousUpload: PreviousUpload) => void>
    >;
    start: ReturnType<typeof vi.fn<() => void>>;
  };

  const instances: UploadInstance[] = [];
  const previousUploads: PreviousUpload[] = [];
  const Upload = vi.fn(function createUpload(
    file: File,
    options: UploadOptions
  ) {
    const instance = {
      file,
      findPreviousUploads: vi.fn(async () => {
        await Promise.resolve();
        return previousUploads;
      }),
      options,
      resumeFromPreviousUpload: vi.fn(),
      start: vi.fn(),
    };
    instances.push(instance);
    return instance;
  });

  return { instances, previousUploads, Upload };
});

vi.mock('tus-js-client', () => ({
  Upload: tusMocks.Upload,
}));

const session = {
  byteSize: 3,
  endpoint: 'https://uploads.mitsailing.com/cms-media/uploads/',
  expiresAt: '2026-05-17T12:00:00.000Z',
  headers: { 'x-mitsailing-upload-token': 'header-token' },
  metadata: {
    assetId: 'asset-1',
    byteSize: '3',
    filename: 'race.png',
    filetype: 'image/png',
    token: 'metadata-token',
  },
  protocol: 'tus' as const,
};

function lastTusUpload(): MockTusUploadInstance {
  const upload = tusMocks.instances.at(-1);
  if (!upload) {
    throw new Error('Expected tus upload instance');
  }
  return upload;
}

beforeEach(() => {
  tusMocks.Upload.mockClear();
  tusMocks.instances.length = 0;
  tusMocks.previousUploads.length = 0;
});

describe('uploadCmsMediaWithTus', () => {
  it('creates a tus upload with session details and starts it', async () => {
    const file = new File(['png'], 'race.png', { type: 'image/png' });
    const onProgress = vi.fn();
    const uploadPromise = uploadCmsMediaWithTus({
      file,
      onProgress,
      session,
    });
    await vi.waitFor(() => {
      expect(tusMocks.Upload).toHaveBeenCalled();
    });
    const upload = lastTusUpload();

    expect(tusMocks.Upload).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        endpoint: session.endpoint,
        headers: session.headers,
        metadata: session.metadata,
        onProgress,
        removeFingerprintOnSuccess: true,
        retryDelays: [0, 3000, 5000, 10_000, 20_000],
        uploadSize: session.byteSize,
      })
    );
    expect(upload.findPreviousUploads).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(upload.start).toHaveBeenCalled();
    });

    upload.options.onSuccess();

    await expect(uploadPromise).resolves.toEqual({ assetId: 'asset-1' });
  });

  it('resumes the newest previous upload before starting', async () => {
    const oldUpload = {
      creationTime: '2026-05-17T12:00:00.000Z',
      metadata: { assetId: 'asset-old' },
      uploadUrl: 'https://uploads.mitsailing.com/cms-media/uploads/old',
    };
    const newUpload = {
      creationTime: '2026-05-17T12:10:00.000Z',
      metadata: { assetId: 'asset-new' },
      uploadUrl: 'https://uploads.mitsailing.com/cms-media/uploads/new',
    };
    tusMocks.previousUploads.push(oldUpload, newUpload);

    const uploadPromise = uploadCmsMediaWithTus({
      file: new File(['png'], 'race.png', { type: 'image/png' }),
      session,
    });
    await vi.waitFor(() => {
      expect(lastTusUpload().resumeFromPreviousUpload).toHaveBeenCalled();
    });
    const upload = lastTusUpload();

    expect(upload.resumeFromPreviousUpload).toHaveBeenCalledWith(newUpload);
    expect(upload.start).toHaveBeenCalled();

    upload.options.onSuccess();

    await expect(uploadPromise).resolves.toEqual({ assetId: 'asset-new' });
  });

  it('rejects when tus reports an upload error', async () => {
    const uploadPromise = uploadCmsMediaWithTus({
      file: new File(['png'], 'race.png', { type: 'image/png' }),
      session,
    });
    await vi.waitFor(() => {
      expect(lastTusUpload().start).toHaveBeenCalled();
    });

    lastTusUpload().options.onError(new Error('upload failed'));

    await expect(uploadPromise).rejects.toThrow('upload failed');
  });
});
