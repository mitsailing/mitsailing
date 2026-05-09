import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AppThemeProvider,
  useAppTheme,
} from '@/components/shell/AppThemeProvider';

function ThemeProbe() {
  const theme = useAppTheme();
  return <span>{theme.resolvedTheme}</span>;
}

function MissingProviderProbe() {
  useAppTheme();
  return null;
}

describe('AppThemeProvider client behavior', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies system theme changes and removes listeners on unmount', () => {
    const listeners: ((event: Event) => void)[] = [];
    let prefersDark = true;

    const addEventListener = vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject | null) => {
        if (type === 'change' && typeof listener === 'function') {
          listeners.push(listener as (event: Event) => void);
        }
      }
    );
    const removeEventListener = vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject | null) => {
        if (type !== 'change' || typeof listener !== 'function') {
          return;
        }
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    );

    const media: MediaQueryList = {
      addEventListener,
      addListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      get matches() {
        return prefersDark;
      },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      removeEventListener,
      removeListener: vi.fn(),
    };

    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media)
    );

    const view = render(
      <AppThemeProvider defaultTheme="system">
        <ThemeProbe />
      </AppThemeProvider>
    );

    expect(screen.getByText('dark')).toBeVisible();
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.dataset.theme).toBe('system');
    expect(document.documentElement.style.colorScheme).toBe('dark');

    prefersDark = false;
    act(() => {
      for (const listener of listeners) {
        listener(new Event('change'));
      }
    });

    expect(screen.getByText('light')).toBeVisible();
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement.dataset.theme).toBe('system');
    expect(document.documentElement.style.colorScheme).toBe('light');

    view.unmount();

    expect(removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
  });

  it('throws when the theme hook is used outside the provider', () => {
    expect(() => render(<MissingProviderProbe />)).toThrow(
      'useAppTheme must be used inside AppThemeProvider.'
    );
  });
});
