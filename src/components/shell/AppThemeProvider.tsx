'use client';

import { ThemeProvider } from 'next-themes';
import type { NextColorScheme } from '@/lib/mit-sailing/themePreference';

type AppThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme: NextColorScheme;
};

export function AppThemeProvider(props: AppThemeProviderProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={props.defaultTheme}
      disableTransitionOnChange
      enableSystem
      storageKey="mitsailing-theme"
    >
      {props.children}
    </ThemeProvider>
  );
}
