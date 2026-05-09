import 'server-only';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Env } from '@/libs/Env';
import { resolveCmsMediaStoragePath } from '@/libs/mit-sailing/cmsMediaValidation';

function cmsMediaRoot(): string {
  return path.resolve(Env.CMS_MEDIA_ROOT);
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && Reflect.get(error, 'code') === 'ENOENT';
}

function cmsMediaFilePath(props: {
  id: string;
  filename: string;
}): string | null {
  return resolveCmsMediaStoragePath({
    root: cmsMediaRoot(),
    id: props.id,
    filename: props.filename,
  });
}

export async function writeCmsMediaFile(props: {
  id: string;
  filename: string;
  bytes: Uint8Array;
}): Promise<string | null> {
  const fullPath = cmsMediaFilePath({
    id: props.id,
    filename: props.filename,
  });
  if (!fullPath) {
    return null;
  }
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, props.bytes);
  return fullPath;
}

export async function readCmsMediaFile(props: {
  id: string;
  filename: string;
}): Promise<Buffer | null> {
  const fullPath = cmsMediaFilePath({
    id: props.id,
    filename: props.filename,
  });
  if (!fullPath) {
    return null;
  }
  try {
    const bytes = await readFile(fullPath);
    return bytes;
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
}
