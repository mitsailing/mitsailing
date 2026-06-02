import { describe, expect, it } from 'vitest';
import {
  choosePublishedRevision,
  isEditableEmailTemplateKey,
} from '@/libs/email-templates/emailTemplatePublishing';

describe('email template publishing', () => {
  it('recognizes editable V1 template keys', () => {
    expect(isEditableEmailTemplateKey('pavilion_reservation_submitted')).toBe(
      true
    );
    expect(isEditableEmailTemplateKey('auth_sign_in_otp')).toBe(false);
  });

  it('chooses the newest published revision', () => {
    const older = {
      id: 'old',
      publishedAt: new Date('2026-05-01T12:00:00.000Z'),
      status: 'published',
    } as const;
    const newer = {
      id: 'new',
      publishedAt: new Date('2026-06-01T12:00:00.000Z'),
      status: 'published',
    } as const;

    expect(choosePublishedRevision([older, newer])?.id).toBe('new');
  });

  it('returns null when no revision is published', () => {
    expect(
      choosePublishedRevision([
        {
          id: 'draft',
          publishedAt: null,
          status: 'draft',
        } as const,
      ])
    ).toBeNull();
  });
});
