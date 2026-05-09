import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { componentTestRouter } from '@/test/component';
import { VerifyEmailForm } from './VerifyEmailForm';

const authClientMock = vi.hoisted(() => ({
  emailOtp: {
    sendVerificationOtp: vi.fn(),
    verifyEmail: vi.fn(),
  },
}));

vi.mock('@/libs/auth-client', () => ({
  authClient: authClientMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  authClientMock.emailOtp.sendVerificationOtp.mockResolvedValue({});
  authClientMock.emailOtp.verifyEmail.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('VerifyEmailForm', () => {
  describe('verification', () => {
    it('Unverified sailor verifies email and returns to the callback', async () => {
      const user = userEvent.setup();

      render(
        <VerifyEmailForm callbackUrl="/fleet/" initialEmail="sailor@mit.edu" />
      );

      await user.type(screen.getByLabelText('Verification code'), '123456');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(authClientMock.emailOtp.verifyEmail).toHaveBeenCalledWith({
        email: 'sailor@mit.edu',
        otp: '123456',
      });
      expect(componentTestRouter().push).toHaveBeenCalledWith('/fleet/');
      expect(componentTestRouter().refresh).toHaveBeenCalledTimes(1);
    });

    it('Rejects unsafe callback and uses fallback', async () => {
      const user = userEvent.setup();

      render(
        <VerifyEmailForm
          callbackUrl="https://malicious.example.com"
          initialEmail="sailor@mit.edu"
        />
      );

      await user.type(screen.getByLabelText('Verification code'), '123456');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(authClientMock.emailOtp.verifyEmail).toHaveBeenCalledWith({
        email: 'sailor@mit.edu',
        otp: '123456',
      });
      expect(componentTestRouter().push).toHaveBeenCalledWith('/');
      expect(componentTestRouter().refresh).toHaveBeenCalledTimes(1);
    });

    it('Unverified sailor sees invalid-code message', async () => {
      const user = userEvent.setup();
      authClientMock.emailOtp.verifyEmail.mockResolvedValue({
        error: { code: 'INVALID_OTP' },
      });

      render(
        <VerifyEmailForm callbackUrl="/fleet/" initialEmail="sailor@mit.edu" />
      );

      await user.type(screen.getByLabelText('Verification code'), '111111');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That code is invalid.'
      );
    });

    it('Unverified sailor sees expired-code message', async () => {
      const user = userEvent.setup();
      authClientMock.emailOtp.verifyEmail.mockResolvedValue({
        error: { code: 'OTP_EXPIRED' },
      });

      render(
        <VerifyEmailForm callbackUrl="/fleet/" initialEmail="sailor@mit.edu" />
      );

      await user.type(screen.getByLabelText('Verification code'), '111111');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That code expired.'
      );
    });

    it('Unverified sailor sees too-many-attempts message', async () => {
      const user = userEvent.setup();
      authClientMock.emailOtp.verifyEmail.mockResolvedValue({
        error: { code: 'TOO_MANY_ATTEMPTS' },
      });

      render(
        <VerifyEmailForm callbackUrl="/fleet/" initialEmail="sailor@mit.edu" />
      );

      await user.type(screen.getByLabelText('Verification code'), '111111');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Too many code attempts.'
      );
    });

    it('Unverified sailor sees rate-limit message from verification', async () => {
      const user = userEvent.setup();
      authClientMock.emailOtp.verifyEmail.mockResolvedValue({
        error: { code: 'TOO_MANY_REQUESTS' },
      });

      render(
        <VerifyEmailForm callbackUrl="/fleet/" initialEmail="sailor@mit.edu" />
      );

      await user.type(screen.getByLabelText('Verification code'), '111111');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Too many code requests. Wait a few minutes.'
      );
    });

    it('Unverified sailor sees invalid-code message for unmapped verification errors', async () => {
      const user = userEvent.setup();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      authClientMock.emailOtp.verifyEmail.mockResolvedValue({
        error: { message: 'Code was already used.' },
      });

      render(
        <VerifyEmailForm callbackUrl="/fleet/" initialEmail="sailor@mit.edu" />
      );

      await user.type(screen.getByLabelText('Verification code'), '111111');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That code is invalid.'
      );
      expect(warnSpy).toHaveBeenCalledWith(
        '[VerifyEmailForm] Unmapped OTP error',
        expect.objectContaining({ message: 'Code was already used.' })
      );
      warnSpy.mockRestore();
    });

    it('Unverified sailor sees invalid-code message for empty verification errors', async () => {
      const user = userEvent.setup();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      authClientMock.emailOtp.verifyEmail.mockResolvedValue({
        error: {},
      });

      render(
        <VerifyEmailForm callbackUrl="/fleet/" initialEmail="sailor@mit.edu" />
      );

      await user.type(screen.getByLabelText('Verification code'), '111111');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That code is invalid.'
      );
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('Unverified sailor sees request message when verification fails', async () => {
      const user = userEvent.setup();
      authClientMock.emailOtp.verifyEmail.mockRejectedValue(
        new Error('network')
      );

      render(
        <VerifyEmailForm callbackUrl="/fleet/" initialEmail="sailor@mit.edu" />
      );

      await user.type(screen.getByLabelText('Verification code'), '111111');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not complete that request right now.'
      );
    });
  });

  describe('validation', () => {
    it('Unverified sailor enters an email when the link has none', async () => {
      const user = userEvent.setup();

      render(<VerifyEmailForm callbackUrl="/fleet/" initialEmail="" />);

      expect(screen.getByText(/your email/)).toBeVisible();
      await user.type(screen.getByLabelText('Email'), 'sailor@mit.edu');
      await user.type(screen.getByLabelText('Verification code'), '123456');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(authClientMock.emailOtp.verifyEmail).toHaveBeenCalledWith({
        email: 'sailor@mit.edu',
        otp: '123456',
      });
    });

    it('Normalizes typed email before verify and resend', async () => {
      const user = userEvent.setup();

      render(<VerifyEmailForm callbackUrl="/fleet/" initialEmail="" />);

      await user.type(screen.getByLabelText('Email'), '  Sailor@MIT.EDU  ');
      await user.type(screen.getByLabelText('Verification code'), '123456');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(authClientMock.emailOtp.verifyEmail).toHaveBeenCalledWith({
        email: 'sailor@mit.edu',
        otp: '123456',
      });

      authClientMock.emailOtp.verifyEmail.mockClear();
      await user.click(screen.getByRole('button', { name: 'Resend email' }));

      expect(authClientMock.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
        email: 'sailor@mit.edu',
        type: 'email-verification',
      });
    });

    it('Unverified sailor sees a safe error before submitting an invalid email', async () => {
      const user = userEvent.setup();

      render(<VerifyEmailForm callbackUrl="/fleet/" initialEmail="" />);

      await user.type(screen.getByLabelText('Email'), 'sailor@mit');
      await user.type(screen.getByLabelText('Verification code'), '123456');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Enter a valid email address with a domain'
      );
      expect(authClientMock.emailOtp.verifyEmail).not.toHaveBeenCalled();
    });

    it('Unverified sailor sees a safe error before resending without an email', async () => {
      const user = userEvent.setup();

      render(<VerifyEmailForm callbackUrl="/fleet/" initialEmail="" />);

      await user.click(screen.getByRole('button', { name: 'Resend email' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Enter a valid email address with a domain'
      );
      expect(
        authClientMock.emailOtp.sendVerificationOtp
      ).not.toHaveBeenCalled();
    });
  });

  describe('resend', () => {
    it('Unverified sailor resends a verification code', async () => {
      const user = userEvent.setup();

      render(
        <VerifyEmailForm callbackUrl="/fleet/" initialEmail="sailor@mit.edu" />
      );

      await user.click(screen.getByRole('button', { name: 'Resend email' }));

      expect(authClientMock.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
        email: 'sailor@mit.edu',
        type: 'email-verification',
      });
      expect(
        await screen.findByText('We sent a new verification code.')
      ).toBeVisible();
    });

    it('Unverified sailor sees rate-limit message when resend is blocked', async () => {
      const user = userEvent.setup();
      authClientMock.emailOtp.sendVerificationOtp.mockResolvedValue({
        error: { code: 'TOO_MANY_REQUESTS' },
      });

      render(
        <VerifyEmailForm callbackUrl="/fleet/" initialEmail="sailor@mit.edu" />
      );

      await user.click(screen.getByRole('button', { name: 'Resend email' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Too many code requests.'
      );
    });

    it('Unverified sailor sees request message when resend fails', async () => {
      const user = userEvent.setup();
      authClientMock.emailOtp.sendVerificationOtp.mockRejectedValue(
        new Error('network')
      );

      render(
        <VerifyEmailForm callbackUrl="/fleet/" initialEmail="sailor@mit.edu" />
      );

      await user.click(screen.getByRole('button', { name: 'Resend email' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not complete that request right now.'
      );
    });
  });

  describe('cooldown', () => {
    it('Unverified sailor sees resend unlock after the cooldown', async () => {
      vi.useFakeTimers();

      render(
        <VerifyEmailForm callbackUrl="/fleet/" initialEmail="sailor@mit.edu" />
      );

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Resend email' }));
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(
        screen.getByRole('button', {
          name: 'You can request a new code in 30 seconds',
        })
      ).toBeDisabled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      expect(
        screen.getByRole('button', { name: 'Resend email' })
      ).toBeEnabled();
    });

    it('Unverified sailor waits through the initial resend cooldown', async () => {
      vi.useFakeTimers();

      render(
        <VerifyEmailForm
          callbackUrl="/fleet/"
          initialEmail="sailor@mit.edu"
          initialResendLocked
        />
      );

      expect(
        screen.getByRole('button', {
          name: 'You can request a new code in 30 seconds',
        })
      ).toBeDisabled();
      expect(
        authClientMock.emailOtp.sendVerificationOtp
      ).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      expect(
        screen.getByRole('button', { name: 'Resend email' })
      ).toBeEnabled();
    });

    it('Unverified sailor refreshes the cooldown when the lock restarts', async () => {
      vi.useFakeTimers();
      const resend = Promise.withResolvers<object>();
      authClientMock.emailOtp.sendVerificationOtp.mockImplementationOnce(
        async () => {
          const value = await resend.promise;
          return value;
        }
      );

      const { rerender } = render(
        <VerifyEmailForm callbackUrl="/fleet/" initialEmail="sailor@mit.edu" />
      );

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Resend email' }));
      });
      await act(async () => {
        await Promise.resolve();
      });

      rerender(
        <VerifyEmailForm
          callbackUrl="/fleet/"
          initialEmail="sailor@mit.edu"
          initialResendLocked
        />
      );

      await act(async () => {
        resend.resolve({});
        await Promise.resolve();
      });

      expect(
        screen.getByRole('button', {
          name: 'You can request a new code in 30 seconds',
        })
      ).toBeDisabled();
    });
  });
});
