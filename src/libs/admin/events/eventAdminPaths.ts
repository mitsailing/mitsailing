const ADMIN_EVENTS_PATH = '/admin/events';

export function adminEventsIndexPath(): string {
  return ADMIN_EVENTS_PATH;
}

export function adminEventsNewPath(): string {
  return `${ADMIN_EVENTS_PATH}/new`;
}

function encodedAdminEventSlug(slug: string): string {
  if (slug.trim().length === 0) {
    throw new Error('Event slug cannot be empty');
  }
  return encodeURIComponent(slug);
}

export function adminEventEditPath(slug: string): string {
  return `${ADMIN_EVENTS_PATH}/${encodedAdminEventSlug(slug)}/edit`;
}

export function adminEventDeletePath(slug: string): string {
  return `${ADMIN_EVENTS_PATH}/${encodedAdminEventSlug(slug)}/delete`;
}

export function adminEventRegistrationsPath(slug: string): string {
  return `${ADMIN_EVENTS_PATH}/${encodedAdminEventSlug(slug)}/registrations`;
}
