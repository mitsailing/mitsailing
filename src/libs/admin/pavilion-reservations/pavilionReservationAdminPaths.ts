export type AdminPavilionReservationHref =
  | string
  | { pathname: string; query: Record<string, string> };

export function adminPavilionReservationIndexPath() {
  return '/admin/pavilion-reservations';
}

export function adminPavilionReservationDetailPath(id: string) {
  return `/admin/pavilion-reservations/${encodeURIComponent(id)}`;
}

export function validateAdminPavilionReservationHref(
  href: AdminPavilionReservationHref
) {
  const indexPath = adminPavilionReservationIndexPath();
  const pathname = typeof href === 'string' ? href : href.pathname;

  if (pathname === indexPath || pathname.startsWith(`${indexPath}/`)) {
    return href;
  }

  throw new TypeError(`Invalid Pavilion reservation admin href: ${pathname}`);
}
