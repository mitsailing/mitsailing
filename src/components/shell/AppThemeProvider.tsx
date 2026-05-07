'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { AppColorScheme } from '@/lib/mit-sailing/themePreference';

type AppThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme: AppColorScheme;
};

type ResolvedColorScheme = 'light' | 'dark';

type AppThemeContextValue = {
  resolvedTheme: ResolvedColorScheme;
  setTheme: React.Dispatch<React.SetStateAction<AppColorScheme>>;
  theme: AppColorScheme;
};

const colorSchemeQuery = '(prefers-color-scheme: dark)';

const ResolvedThemeContext = createContext<ResolvedColorScheme | null>(null);
const SetThemeContext = createContext<React.Dispatch<
  React.SetStateAction<AppColorScheme>
> | null>(null);
const ThemeContext = createContext<AppColorScheme | null>(null);

function resolveTheme(theme: AppColorScheme): ResolvedColorScheme {
  if (theme === 'dark') {
    return 'dark';
  }
  if (theme === 'light') {
    return 'light';
  }
  return window.matchMedia(colorSchemeQuery).matches ? 'dark' : 'light';
}

function applyTheme(theme: AppColorScheme): ResolvedColorScheme {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = resolved;
  return resolved;
}

export function AppThemeProvider(props: AppThemeProviderProps) {
  const [theme, setThemeState] = useState<AppColorScheme>(props.defaultTheme);
  const [resolvedTheme, setResolvedTheme] =
    useState<ResolvedColorScheme>('light');

  useEffect(() => {
    setThemeState(props.defaultTheme);
  }, [props.defaultTheme]);

  useEffect(() => {
    setResolvedTheme(applyTheme(theme));
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') {
      return;
    }

    const media = window.matchMedia(colorSchemeQuery);
    const onChange = () => {
      setResolvedTheme(applyTheme(theme));
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, [theme]);

  return (
    <SetThemeContext.Provider value={setThemeState}>
      <ThemeContext.Provider value={theme}>
        <ResolvedThemeContext.Provider value={resolvedTheme}>
          {props.children}
        </ResolvedThemeContext.Provider>
      </ThemeContext.Provider>
    </SetThemeContext.Provider>
  );
}

export function useAppTheme(): AppThemeContextValue {
  const resolvedTheme = useContext(ResolvedThemeContext);
  const setTheme = useContext(SetThemeContext);
  const theme = useContext(ThemeContext);
  if (!resolvedTheme || !setTheme || !theme) {
    throw new Error('useAppTheme must be used inside AppThemeProvider.');
  }
  return { resolvedTheme, setTheme, theme };
}
