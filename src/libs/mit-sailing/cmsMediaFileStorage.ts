import path from 'node:path';

function isStorageSegment(value: string): boolean {
  return (
    value.length > 0 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\')
  );
}

function containedPath(root: string, ...segments: string[]): string | null {
  if (!segments.every(isStorageSegment)) {
    return null;
  }
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, ...segments);
  const rootPrefix = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : `${resolvedRoot}${path.sep}`;
  return candidate.startsWith(rootPrefix) ? candidate : null;
}

export function buildCmsMediaReadyPath(props: {
  assetId: string;
  filename: string;
  root: string;
}): string | null {
  return containedPath(props.root, 'ready', props.assetId, props.filename);
}

export function resolveTusUploadFilePath(props: {
  root: string;
  uploadId: string;
}): string | null {
  return containedPath(props.root, 'uploads', props.uploadId);
}

export function buildCmsMediaReadyUrl(props: {
  baseUrl: string;
  publicPath: string;
}): string {
  return `${props.baseUrl.replace(/\/$/u, '')}${props.publicPath}`;
}
