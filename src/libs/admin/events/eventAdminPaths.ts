const ADMIN_EVENTS_PATH = '/admin/events';

export function adminEventsIndexPath(): string {
  return ADMIN_EVENTS_PATH;
}

export function adminEventsNewPath(): string {
  return `${ADMIN_EVENTS_PATH}/new`;
}

export function adminEventEditPath(slug: string): string {
  return `${ADMIN_EVENTS_PATH}/${encodeURIComponent(slug)}/edit`;
}

export function adminEventDeletePath(slug: string): string {
  return `${ADMIN_EVENTS_PATH}/${encodeURIComponent(slug)}/delete`;
}

export function adminEventRegistrationsPath(slug: string): string {
  return `${ADMIN_EVENTS_PATH}/${encodeURIComponent(slug)}/registrations`;
}
