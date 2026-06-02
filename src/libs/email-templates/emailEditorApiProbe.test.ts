import { describe, expect, it } from 'vitest';

describe('React Email editor package', () => {
  it('keeps the documented editor exports available', async () => {
    const editor = await import('@react-email/editor');
    const core = await import('@react-email/editor/core');

    expect(editor.EmailEditor).toBeDefined();
    expect(typeof core.composeReactEmail).toBe('function');
  });
});
