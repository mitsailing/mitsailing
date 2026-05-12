import { createHash, timingSafeEqual } from 'node:crypto';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function isAuthorizedHealthRequest(params: {
  authorizationHeader: string | null;
  secret: string | undefined;
}): boolean {
  if (!params.secret || !params.authorizationHeader) {
    return false;
  }

  const expected = `Bearer ${params.secret}`;
  return timingSafeEqual(digest(params.authorizationHeader), digest(expected));
}
