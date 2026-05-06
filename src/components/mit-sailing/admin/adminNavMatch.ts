import { normalizeNavPath } from '@/lib/mit-sailing/navPathMatch';

export type AdminNavMatchMode = 'exact' | 'prefix';

export function isAdminNavItemActive(props: {
  pathname: string;
  href: string;
  match: AdminNavMatchMode;
}): boolean {
  const p = normalizeNavPath(props.pathname);
  const h = normalizeNavPath(props.href);
  if (props.match === 'exact') {
    return p === h;
  }
  return p === h || p.startsWith(`${h}/`);
}
