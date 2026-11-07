/** Prisma interactive transaction limits for large legacy imports. */
export const legacyImportTransactionOptions = {
  maxWait: 10_000,
  timeout: 120_000,
} as const;
