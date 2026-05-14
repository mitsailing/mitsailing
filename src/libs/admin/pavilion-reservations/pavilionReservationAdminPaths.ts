export function adminPavilionReservationIndexPath() {
  return '/admin/pavilion-reservations';
}

export function adminPavilionReservationDetailPath(id: string) {
  return `/admin/pavilion-reservations/${encodeURIComponent(id)}`;
}
