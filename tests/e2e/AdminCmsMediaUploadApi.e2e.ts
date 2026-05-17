import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import { signInAsAdmin } from '../helpers/e2e-admin-sign-in';
import {
  deleteE2eCmsMediaAsset,
  insertE2eCmsMediaAsset,
} from '../helpers/e2e-cms-media-asset';
import { e2ePgConnectionString } from '../helpers/e2e-database-url';

const pool = new Pool({ connectionString: e2ePgConnectionString() });

function cmsMediaUploadApiPath(assetId: string): string {
  return `/api/admin/cms-media/uploads/${encodeURIComponent(assetId)}`;
}

test.describe.configure({ mode: 'serial' });

test.afterAll(async () => {
  await pool.end();
});

test.describe('admin cms media upload api', () => {
  test('finalize is idempotent when asset is already queued', async ({
    page,
  }) => {
    const assetId = `e2e-finalize-queued-${Date.now()}`;
    const publicPath = `/cms-media/${assetId}/e2e-media.png`;

    await insertE2eCmsMediaAsset(pool, {
      id: assetId,
      publicPath,
      status: 'queued',
    });

    try {
      await signInAsAdmin(page, { expectedPath: '/' });

      const first = await page.request.post(
        `${cmsMediaUploadApiPath(assetId)}/finalize`
      );
      const second = await page.request.post(
        `${cmsMediaUploadApiPath(assetId)}/finalize`
      );

      expect(first.status()).toBe(200);
      expect(second.status()).toBe(200);
      await expect(first.json()).resolves.toMatchObject({
        asset: { id: assetId, status: 'queued' },
      });
      await expect(second.json()).resolves.toMatchObject({
        asset: { id: assetId, status: 'queued' },
      });
    } finally {
      await deleteE2eCmsMediaAsset(pool, assetId);
    }
  });

  test('cancel is idempotent when upload was already cancelled', async ({
    page,
  }) => {
    const assetId = `e2e-cancel-repeat-${Date.now()}`;
    const publicPath = `/cms-media/${assetId}/e2e-media.png`;

    await insertE2eCmsMediaAsset(pool, {
      id: assetId,
      processingErrorCode: 'upload_cancelled',
      publicPath,
      status: 'failed',
    });

    try {
      await signInAsAdmin(page, { expectedPath: '/' });

      const response = await page.request.delete(
        cmsMediaUploadApiPath(assetId)
      );

      expect(response.status()).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        asset: {
          id: assetId,
          processingErrorCode: 'upload_cancelled',
          status: 'failed',
        },
      });
    } finally {
      await deleteE2eCmsMediaAsset(pool, assetId);
    }
  });

  test('cancel is idempotent across concurrent delete requests', async ({
    page,
  }) => {
    const assetId = `e2e-cancel-race-${Date.now()}`;
    const publicPath = `/cms-media/${assetId}/e2e-media.png`;

    await insertE2eCmsMediaAsset(pool, {
      id: assetId,
      publicPath,
      status: 'uploading',
    });

    try {
      await signInAsAdmin(page, { expectedPath: '/' });

      const uploadPath = cmsMediaUploadApiPath(assetId);
      const [first, second] = await Promise.all([
        page.request.delete(uploadPath),
        page.request.delete(uploadPath),
      ]);

      expect(first.status()).toBe(200);
      expect(second.status()).toBe(200);
      await expect(first.json()).resolves.toMatchObject({
        asset: {
          id: assetId,
          processingErrorCode: 'upload_cancelled',
          status: 'failed',
        },
      });
      await expect(second.json()).resolves.toMatchObject({
        asset: {
          id: assetId,
          processingErrorCode: 'upload_cancelled',
          status: 'failed',
        },
      });

      const { rows } = await pool.query(
        'SELECT "status" FROM "cms_media_assets" WHERE "id" = $1',
        [assetId]
      );
      expect(rows).toHaveLength(1);
      expect(String(rows[0]?.status)).toBe('failed');
    } finally {
      await deleteE2eCmsMediaAsset(pool, assetId);
    }
  });

  test('returns 409 when cancel targets a non-uploading asset', async ({
    page,
  }) => {
    const assetId = `e2e-cancel-queued-${Date.now()}`;
    const publicPath = `/cms-media/${assetId}/e2e-media.png`;

    await insertE2eCmsMediaAsset(pool, {
      id: assetId,
      publicPath,
      status: 'queued',
    });

    try {
      await signInAsAdmin(page, { expectedPath: '/' });

      const response = await page.request.delete(
        cmsMediaUploadApiPath(assetId)
      );

      expect(response.status()).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: 'upload_not_cancellable',
      });
    } finally {
      await deleteE2eCmsMediaAsset(pool, assetId);
    }
  });
});
