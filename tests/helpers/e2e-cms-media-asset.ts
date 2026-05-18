import type { Pool } from 'pg';

export type E2eCmsMediaAssetSeed = {
  id: string;
  processingErrorCode?: string | null;
  publicPath: string;
  status: 'failed' | 'processing' | 'queued' | 'ready' | 'uploading';
};

export async function insertE2eCmsMediaAsset(
  pool: Pool,
  props: E2eCmsMediaAssetSeed
): Promise<void> {
  await pool.query(
    `INSERT INTO "cms_media_assets" (
      "id",
      "stored_filename",
      "original_filename",
      "mime_type",
      "byte_size",
      "public_path",
      "status",
      "media_kind",
      "storage_provider",
      "processing_error_code"
    ) VALUES (
      $1,
      $2,
      $3,
      'image/png',
      1024,
      $4,
      $5::cms_media_status,
      'image'::cms_media_kind,
      'server_folder'::cms_media_storage_provider,
      $6
    )`,
    [
      props.id,
      `${props.id}.png`,
      'E2E media.png',
      props.publicPath,
      props.status,
      props.processingErrorCode ?? null,
    ]
  );
}

export async function deleteE2eCmsMediaAsset(
  pool: Pool,
  assetId: string
): Promise<void> {
  await pool.query('DELETE FROM "cms_media_assets" WHERE "id" = $1', [assetId]);
}
