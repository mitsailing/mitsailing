import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OtpCodeField, extractOtpCode } from './OtpCodeField';

function StatefulOtpCodeField(props: {
  onValueChange: (value: string) => void;
}) {
  const [value, setValue] = useState('');

  function onValueChange(nextValue: string) {
    setValue(nextValue);
    props.onValueChange(nextValue);
  }

  return (
    <OtpCodeField
      id="code"
      label="Verification code"
      name="code"
      onValueChange={onValueChange}
      pasteLabel="Paste code"
      placeholder="Code"
      value={value}
    />
  );
}

function renderOtpCodeField(options?: {
  onValueChange?: (value: string) => void;
  value?: string;
}) {
  render(
    <OtpCodeField
      id="code"
      label="Verification code"
      name="code"
      onValueChange={options?.onValueChange ?? vi.fn()}
      pasteLabel="Paste code"
      placeholder="Code"
      value={options?.value ?? ''}
    />
  );
}

describe('OtpCodeField', () => {
  it('renders a platform-friendly one-time code input', () => {
    renderOtpCodeField();

    const input = screen.getByLabelText('Verification code');

    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('maxlength', '6');
    expect(input).toHaveAttribute('pattern', '[0-9]{6}');
    expect(input).toHaveAttribute('type', 'text');
  });

  it('normalizes typed code input to six digits', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<StatefulOtpCodeField onValueChange={onValueChange} />);

    await user.type(screen.getByLabelText('Verification code'), '12a34 567');

    expect(onValueChange).toHaveBeenLastCalledWith('123456');
  });

  it('pastes the first six-digit code from clipboard text', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const readText = vi.fn().mockResolvedValue('Your code is 123456.');
    const clipboard: Clipboard = {
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      read: vi.fn(async () => {
        await Promise.resolve();
        return [];
      }),
      readText,
      removeEventListener: vi.fn(),
      write: vi.fn(),
      writeText: vi.fn(),
    };
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue(clipboard);
    renderOtpCodeField({ onValueChange });

    await user.click(screen.getByRole('button', { name: 'Paste code' }));

    expect(readText).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('123456');
  });

  it('accepts native paste events from mail clients', () => {
    const onValueChange = vi.fn();
    renderOtpCodeField({ onValueChange });

    fireEvent.paste(screen.getByLabelText('Verification code'), {
      clipboardData: {
        getData: () => 'Code: 654321',
      },
    });

    expect(onValueChange).toHaveBeenCalledWith('654321');
  });
});

describe('extractOtpCode', () => {
  it('extracts domain-bound email code lines', () => {
    expect(extractOtpCode('@mitsailing.com #987654')).toBe('987654');
  });

  it('falls back to the first six digits after stripping separators', () => {
    expect(extractOtpCode('Paste 123 456 from your email')).toBe('123456');
  });
});
