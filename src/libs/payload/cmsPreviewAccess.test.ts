import { describe, expect, it } from 'vitest';
import { sessionCanPreviewCmsDrafts } from '@/libs/payload/cmsPreviewAccess';

describe('sessionCanPreviewCmsDrafts', () => {
  it('allows CMS admins and refuses logged-out visitors', () => {
    expect(sessionCanPreviewCmsDrafts({ appRole: 'admin' })).toBe(true);
    expect(sessionCanPreviewCmsDrafts({ appRole: 'user' })).toBe(false);
    expect(sessionCanPreviewCmsDrafts(null)).toBe(false);
  });
});
