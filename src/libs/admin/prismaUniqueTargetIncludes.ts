import 'server-only';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Whether `error.meta.target` lists a field name involved in the failing unique constraint.
 * Targets may be a string or field-name array depending on provider and constraint shape.
 *
 * @param error Prisma known request error (for example after a unique violation).
 * @param field Model field name to match against `meta.target`.
 * @returns True when `target` is an array containing `field`, or a string that includes `field`.
 */
export function prismaUniqueTargetIncludes(
  error: Prisma.PrismaClientKnownRequestError,
  field: string
): boolean {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((value) => value === field);
  }
  return typeof target === 'string' && target.includes(field);
}
