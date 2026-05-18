import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ADMIN_ROUTE_DIR = path.join(
  process.cwd(),
  'src/app/[locale]/(marketing)/(site)/admin'
);

async function nestedLayoutFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[][] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(await nestedLayoutFiles(fullPath));
    } else if (
      entry.name === 'layout.tsx' &&
      fullPath !== path.join(ADMIN_ROUTE_DIR, 'layout.tsx')
    ) {
      files.push([fullPath]);
    }
  }
  return files.flat();
}

async function adminPageFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[][] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(await adminPageFiles(fullPath));
    } else if (entry.name === 'page.tsx') {
      files.push([fullPath]);
    }
  }
  return files.flat();
}

describe('admin route structure', () => {
  it('keeps every admin child page under the root admin layout', async () => {
    await expect(nestedLayoutFiles(ADMIN_ROUTE_DIR)).resolves.toEqual([]);
  });

  it('keeps every admin page behind an explicit page or section guard', async () => {
    const files = await adminPageFiles(ADMIN_ROUTE_DIR);
    const unguardedFiles = [];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      if (
        !/require(Admin|AdminAreaAccess|Permission|AnyPermission|CatalogPermission|AdminEventAccess)\(/.test(
          source
        )
      ) {
        unguardedFiles.push(path.relative(process.cwd(), file));
      }
    }
    expect(unguardedFiles).toEqual([]);
  });
});
