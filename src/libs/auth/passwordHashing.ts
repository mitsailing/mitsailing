import type { Options } from '@node-rs/argon2';

/**
 * Argon2id parameters for real app password storage.
 */
export const productionArgonOptions = {
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
  outputLen: 32,
  algorithm: 2,
} satisfies Options;

/**
 * Lower-cost Argon2id parameters for Playwright's single-process e2e server.
 */
export const e2eArgonOptions = {
  memoryCost: 4096,
  timeCost: 1,
  parallelism: 1,
  outputLen: 32,
  algorithm: 2,
} satisfies Options;

/**
 * Chooses password hashing options for the current runtime.
 *
 * @param props - Runtime flags that influence hashing cost
 * @returns Argon2id options for password hash/verify
 */
export function selectPasswordHashingOptions(props: {
  isE2E: boolean;
}): Options {
  return props.isE2E ? e2eArgonOptions : productionArgonOptions;
}
