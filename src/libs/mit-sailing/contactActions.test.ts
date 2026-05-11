import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calendarYearInContactFormTimeZone } from '@/libs/mit-sailing/contactForm';

const sendTransactionalEmailMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  })
);

vi.mock('@/libs/email/sendTransactional', () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

function validContactFormData(): FormData {
  const formData = new FormData();
  formData.set('topic', 'Reserve Pavilion');
  formData.set('name', 'Grace Hopper');
  formData.set('email', 'grace@mit.edu');
  formData.set('subject', 'Pavilion event');
  formData.set('message', 'Could we reserve the Pavilion next month?');
  formData.set(
    'currentYear',
    String(calendarYearInContactFormTimeZone(new Date()))
  );
  return formData;
}

describe('submitContactFormAction', () => {
  beforeEach(() => {
    sendTransactionalEmailMock.mockClear();
    redirectMock.mockClear();
  });

  it('sends routed contact submissions before redirecting', async () => {
    const { submitContactFormAction } =
      await import('@/libs/mit-sailing/contactActions');

    await expect(
      submitContactFormAction('en', validContactFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/contact?status=sent#contact-form');

    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '[MIT Sailing Contact] Reserve Pavilion: Pavilion event',
        to: 'sailing@mit.edu',
      })
    );
  });

  it('rejects invalid contact submissions before sending', async () => {
    const { submitContactFormAction } =
      await import('@/libs/mit-sailing/contactActions');
    const formData = validContactFormData();
    formData.set('currentYear', '1900');

    await expect(submitContactFormAction('en', formData)).rejects.toThrow(
      'NEXT_REDIRECT:/contact?status=invalid#contact-form'
    );

    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it('redirects with error when contact email sending fails', async () => {
    sendTransactionalEmailMock.mockRejectedValueOnce(new Error('mail down'));
    const { submitContactFormAction } =
      await import('@/libs/mit-sailing/contactActions');

    await expect(
      submitContactFormAction('en', validContactFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/contact?status=error#contact-form');

    expect(sendTransactionalEmailMock).toHaveBeenCalledTimes(1);
  });
});
