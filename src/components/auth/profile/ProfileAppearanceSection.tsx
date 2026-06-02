'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ProfileInlineBanner } from '@/components/auth/profile/profileBanner';
import type { ProfileBannerState } from '@/components/auth/profile/profileBanner';
import { useAppTheme } from '@/components/shell/AppThemeProvider';
import type {
  AppColorScheme,
  ThemePreferenceValue,
} from '@/lib/mit-sailing/themePreference';
import {
  colorSchemeToThemePreference,
  themePreferenceToColorScheme,
} from '@/lib/mit-sailing/themePreference';
import { cn } from '@/lib/utils';
import { updateThemePreferenceAction } from '@/libs/auth/themePreferenceActions';

type ProfileAppearanceSectionProps = {
  initialPreference: ThemePreferenceValue;
};

type AppearanceOption = {
  labelKey: 'appearance_auto' | 'appearance_light' | 'appearance_dark';
  value: AppColorScheme;
};

const APPEARANCE_OPTIONS: AppearanceOption[] = [
  { labelKey: 'appearance_auto', value: 'system' },
  { labelKey: 'appearance_light', value: 'light' },
  { labelKey: 'appearance_dark', value: 'dark' },
];

export function ProfileAppearanceSection(props: ProfileAppearanceSectionProps) {
  const t = useTranslations('UserProfilePage');
  const locale = useLocale();
  const router = useRouter();
  const { setTheme } = useAppTheme();
  const [stored, setStored] = useState<ThemePreferenceValue>(
    props.initialPreference
  );
  const [banner, setBanner] = useState<ProfileBannerState>(null);
  const [pending, setPending] = useState(false);

  async function onSelect(next: AppColorScheme) {
    setBanner(null);
    const previousPref = stored;
    const previousTheme = themePreferenceToColorScheme(previousPref);
    const nextPref = colorSchemeToThemePreference(next);
    setStored(nextPref);
    setTheme(next);
    setPending(true);
    const res = await updateThemePreferenceAction(locale, next);
    setPending(false);
    if (!res.ok) {
      setStored(previousPref);
      setTheme(previousTheme);
      setBanner({
        kind: 'error',
        message: t('appearance_save_error'),
      });
      return;
    }
    router.refresh();
  }

  const activeScheme = themePreferenceToColorScheme(stored);

  return (
    <section
      aria-labelledby="appearance-heading"
      className="rounded-lg border border-border bg-card p-6 shadow-sm"
      id="appearance-section"
    >
      <h2
        className="text-lg font-medium text-foreground"
        id="appearance-heading"
      >
        {t('appearance_heading')}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('appearance_description')}
      </p>
      <ProfileInlineBanner banner={banner} />
      <fieldset className="mt-4">
        <legend className="sr-only">{t('appearance_heading')}</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {APPEARANCE_OPTIONS.map((opt) => {
            const selected = activeScheme === opt.value;
            return (
              <label className="flex-1" key={opt.value}>
                <input
                  checked={selected}
                  className="peer sr-only"
                  disabled={pending}
                  name="appearance-color-scheme"
                  type="radio"
                  value={opt.value}
                  onChange={() => {
                    // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the save promise.
                    void onSelect(opt.value);
                  }}
                />
                <span
                  className={cn(
                    'block min-h-[44px] rounded-md border px-4 py-2.5 text-left text-sm font-medium transition-colors',
                    'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
                    selected
                      ? 'border-mit-red-600 bg-mit-red-600 text-white'
                      : 'border-border bg-background text-foreground peer-enabled:hover:bg-muted'
                  )}
                >
                  {t(opt.labelKey)}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
