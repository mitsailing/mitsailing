import { render } from 'react-email';
import { describe, expect, it } from 'vitest';
import enMessages from '@/locales/en.json';
import { ContactSubmissionNotificationTemplate } from '../../../emails/contact-submission';

describe('ContactSubmissionNotificationTemplate', () => {
  it('renders escaped submission content', async () => {
    const html = await render(
      ContactSubmissionNotificationTemplate({
        adminUrl: 'https://mitsailing.com/admin/contact_submissions/abc/',
        copy: enMessages.ContactSubmissionEmail,
        createdAt: '2026-05-07T12:00:00.000Z',
        email: 'ada@example.com',
        message: '<script>alert("x")</script> Hello support.',
        name: 'Ada Lovelace',
      })
    );

    expect(html).toContain('ada@example.com');
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;/script&gt;');
    expect(html).not.toContain('</script>');
    expect(html).toContain('Hello support.');
    expect(html).toContain(
      'https://mitsailing.com/admin/contact_submissions/abc/'
    );
  });
});
