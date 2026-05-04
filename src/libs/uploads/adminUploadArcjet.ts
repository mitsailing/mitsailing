import arcjet, { shield, slidingWindow } from '@arcjet/next';
import { Env } from '@/libs/Env';

/**
 * Arcjet client for admin upload POST: shield + per-user sliding window. Only
 * constructed when {@link Env.ARCJET_KEY} is set so local/CI need no key.
 */
export const adminUploadPostArcjet = Env.ARCJET_KEY
  ? arcjet({
      key: Env.ARCJET_KEY,
      characteristics: ['ip.src'],
      rules: [
        shield({ mode: 'LIVE' }),
        slidingWindow({
          mode: 'LIVE',
          interval: '1m',
          max: 60,
          characteristics: ['userId'],
        }),
      ],
    })
  : null;
