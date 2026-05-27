import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'generated' ? [] : listTypeScriptFiles(path);
    }
    return entry.isFile() && path.endsWith('.ts') && !path.endsWith('.test.ts')
      ? [path]
      : [];
  });
}

const serverActionFiles = listTypeScriptFiles('src').filter((file) => {
  const source = readFileSync(file, 'utf8');
  return source.split('\n').includes("'use server';");
});

function exportedRuntimeBindings(source: string) {
  return source
    .split('\n')
    .filter(
      (line) => line.startsWith('export ') && !line.startsWith('export type ')
    )
    .map((line) => line.slice('export '.length).trim())
    .filter((statement) => !statement.startsWith('interface '));
}

function isAsyncFunctionExport(statement: string) {
  if (statement.startsWith('async function ')) {
    return true;
  }

  if (!statement.startsWith('const ')) {
    return false;
  }

  const assignment = statement.indexOf('=');
  if (assignment === -1) {
    return false;
  }

  const initializer = statement.slice(assignment + 1).trimStart();
  return initializer.startsWith('async (') || initializer.startsWith('async<');
}

describe('server action boundaries', () => {
  it('keeps file-level use server modules limited to async function exports', () => {
    const invalidExports = serverActionFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return exportedRuntimeBindings(source)
        .filter((statement) => !isAsyncFunctionExport(statement))
        .map((statement) => `${relative(process.cwd(), file)}: ${statement}`);
    });

    expect(invalidExports).toEqual([]);
  });
});
