import 'server-only';
import config from '@payload-config';
import { getPayload } from 'payload';
import { cache } from 'react';

/**
 * Request-scoped Payload Local API client (one init per RSC request).
 */
export const getPayloadClient = cache(async () => getPayload({ config }));
