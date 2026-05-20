import { describe, expect, it } from 'vitest';
import {
  adminEventRegistrationsReviewPath,
  adminEventShowPath,
} from '@/libs/admin/events/eventAdminPaths';

describe('event admin paths', () => {
  it('builds canonical show paths from slugs', () => {
    expect(adminEventShowPath('intro sail')).toBe('/admin/events/intro%20sail');
  });

  it('builds registration review anchor paths without trailing slashes', () => {
    expect(adminEventRegistrationsReviewPath('intro-sail')).toBe(
      '/admin/events/intro-sail#registrations'
    );
  });

  it('rejects empty show path slugs', () => {
    expect(() => adminEventShowPath('   ')).toThrow(
      'Event slug cannot be empty'
    );
  });
});
