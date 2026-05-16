export function formatPavilionReservationTimeLabel(minutes: number): string {
  const logicalHour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const displayHour = ((logicalHour % 24) + 24) % 24;
  const suffix = displayHour >= 12 ? 'PM' : 'AM';
  const hour12 = displayHour % 12 === 0 ? 12 : displayHour % 12;
  const base = `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
  return logicalHour >= 24 ? `${base} (next day)` : base;
}
