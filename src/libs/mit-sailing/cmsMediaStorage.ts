import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Env } from '@/libs/Env';
import { resolveCmsMediaStoragePath } from '@/libs/mit-sailing/cmsMediaValidation';

function cmsMediaRoot(): string {
  return path.resolve(Env.CMS_MEDIA_ROOT);
}

function errorCode(error: unknown): string | undefined {
  if (!(error instanceof Error) || !('code' in error)) {
    return undefined;
  }
  const { code } = error;
  return typeof code === 'string' ? code : undefined;
}

function isMissingFileError(error: unknown): boolean {
  return errorCode(error) === 'ENOENT';
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

async function removeCmsMediaPath(filePath: string): Promise<void> {
  await rm(filePath, { force: true });
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
  const tempPath = `${fullPath}.tmp-${randomUUID()}`;
  try {
    await writeFile(tempPath, props.bytes, { flag: 'wx' });
    await rename(tempPath, fullPath);
  } catch (error: unknown) {
    try {
      await removeCmsMediaPath(tempPath);
    } catch {
      // Preserve the original write/rename failure.
    }
    throw error;
  }
  return fullPath;
}

export async function deleteCmsMediaFile(props: {
  id: string;
  filename: string;
}): Promise<void> {
  const fullPath = cmsMediaFilePath({
    id: props.id,
    filename: props.filename,
  });
  if (fullPath) {
    await removeCmsMediaPath(fullPath);
  }
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
