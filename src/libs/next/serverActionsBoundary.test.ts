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
  return /^'use server';$/m.test(source);
});

function exportedRuntimeBindings(source: string) {
  return [...source.matchAll(/^export\s+(?!type\s)(.+)$/gm)]
    .map((match) => match[1]?.trim() ?? '')
    .filter((statement) => !statement.startsWith('interface '));
}

function isAsyncFunctionExport(statement: string) {
  return (
    statement.startsWith('async function ') ||
    /^const\s+\w+\s*=\s*async\s*(?:\(|<)/.test(statement)
  );
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
