import { describe, expect, it } from 'vitest';
import messages from '@/locales/en.json';

describe('admin email template labels', () => {
  it('distinguishes admin email templates from newsletter templates', () => {
    expect(messages.AdminIndex.link_newsletter_templates).toBe(
      'Newsletter templates'
    );
    expect(messages.AdminIndex.link_email_templates).toBe(
      'Admin email templates'
    );
    expect(messages.AdminSideNav.nav_email_templates).toBe(
      'Admin email templates'
    );
    expect(messages.AdminEmailTemplates.title).toBe('Admin email templates');
  });
});
