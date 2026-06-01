import { AppConfig } from '@/utils/AppConfig';
import { getI18nPath } from '@/utils/Helpers';

export const MIT_SAILING_PUBLIC_ORIGIN = 'https://mitsailing.com' as const;

function absoluteDiscoveryUrl(origin: string, path: string): string {
  return new URL(path, origin).toString();
}

function publicClassPath(slug: string): string {
  return getI18nPath(
    `/classes/${encodeURIComponent(slug)}`,
    AppConfig.i18n.defaultLocale
  );
}

export function publicClassDetailUrl(
  slug: string,
  origin = MIT_SAILING_PUBLIC_ORIGIN
): string {
  return absoluteDiscoveryUrl(origin, publicClassPath(slug));
}

function publicFleetBoatPath(slug: string): string {
  return getI18nPath(
    `/fleet/${encodeURIComponent(slug)}`,
    AppConfig.i18n.defaultLocale
  );
}

export function publicFleetBoatDetailUrl(
  slug: string,
  origin = MIT_SAILING_PUBLIC_ORIGIN
): string {
  return absoluteDiscoveryUrl(origin, publicFleetBoatPath(slug));
}

export function publicAiDiscoveryUrl(
  origin = MIT_SAILING_PUBLIC_ORIGIN
): string {
  return absoluteDiscoveryUrl(origin, '/llm.txt');
}
