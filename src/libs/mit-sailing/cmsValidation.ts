import * as z from 'zod';
import { parseCmsHomeOverviewBody } from '@/libs/mit-sailing/cmsHomeOverview';
import { isSafeCmsAppPath, safeCmsHref } from '@/libs/mit-sailing/cmsHref';
import { parseCmsPricingBody } from '@/libs/mit-sailing/cmsPricing';

function canonicalCmsAppPath(path: string): string {
  return path === '/' ? path : path.replace(/\/+$/u, '');
}

const cmsPathSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => isSafeCmsAppPath(value),
    'CMS paths must be safe app-relative paths without query strings or fragments'
  )
  .transform((value) => canonicalCmsAppPath(value));

const cmsImagePathSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => isSafeCmsAppPath(value),
    'CMS image paths must be safe app-relative paths without query strings or fragments'
  )
  .transform((value) => canonicalCmsAppPath(value));

const cmsUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    if (value === '#') {
      return true;
    }
    if (value.startsWith('/')) {
      return isSafeCmsAppPath(value, { allowQueryAndFragment: true });
    }
    if (value.includes('\\')) {
      return false;
    }
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }, 'CMS links must be internal paths, #, or http(s) URLs')
  .transform((value) =>
    value.startsWith('/') && !value.startsWith('//')
      ? canonicalCmsAppPath(value)
      : value
  );

export const cmsPageInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  path: cmsPathSchema,
  title: z.string().trim().min(1),
  metaTitle: z.string().trim().min(1),
  metaDescription: z.string().trim().min(1),
  isPublished: z.boolean(),
});

export const cmsBlockInputSchema = z
  .object({
    pageId: z.string().trim().min(1),
    kind: z.enum([
      'hero',
      'text_section',
      'callout',
      'pricing',
      'home_overview',
      'home_classes',
    ]),
    title: z.string().trim().min(1),
    subtitle: z.string().trim().optional(),
    body: z.string().trim().optional(),
    ctaLabel: z.string().trim().optional(),
    ctaUrl: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value === '' ? undefined : value))
      .pipe(cmsUrlSchema.optional()),
    imageSrc: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value === '' ? undefined : value))
      .pipe(cmsImagePathSchema.optional()),
    imageAlt: z.string().trim().optional(),
    isVisible: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.ctaLabel) !== Boolean(value.ctaUrl)) {
      ctx.addIssue({
        code: 'custom',
        message: 'CMS CTA requires both label and URL',
        path: value.ctaLabel ? ['ctaUrl'] : ['ctaLabel'],
      });
    }
    if (Boolean(value.imageSrc) !== Boolean(value.imageAlt)) {
      ctx.addIssue({
        code: 'custom',
        message: 'CMS image requires both source and alt text',
        path: value.imageSrc ? ['imageAlt'] : ['imageSrc'],
      });
    }
    if (value.kind === 'pricing' && !parseCmsPricingBody(value.body)) {
      ctx.addIssue({
        code: 'custom',
        message: 'CMS pricing blocks require one to four pricing options',
        path: ['body'],
      });
    }
    if (value.kind === 'home_overview') {
      const homeOverview = parseCmsHomeOverviewBody(value.body);
      if (!homeOverview) {
        ctx.addIssue({
          code: 'custom',
          message: 'CMS home overview blocks require valid overview settings',
          path: ['body'],
        });
        return;
      }
      if (!safeCmsHref(homeOverview.eventsCtaUrl)) {
        ctx.addIssue({
          code: 'custom',
          message: 'CMS home overview events CTA URL must be safe',
          path: ['body'],
        });
      }
    }
  });

export const cmsMenuItemInputSchema = z.object({
  menuId: z.string().trim().min(1),
  parentId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  linkedPageId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  label: z.string().trim().min(1),
  url: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === '' ? undefined : value))
    .pipe(cmsUrlSchema.optional()),
  isExternal: z.boolean(),
  isVisible: z.boolean(),
  systemKey: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
});

export type CmsMenuTreeNode = {
  id: string;
  parentId: string | null;
};

/**
 * Checks menu parent links for missing parents and cycles before persistence.
 *
 * @param nodes - Proposed menu item parent edges
 * @returns Validation result
 */
export function validateCmsMenuTree(
  nodes: readonly CmsMenuTreeNode[]
): { ok: true } | { ok: false; code: 'missing_parent' | 'cycle' } {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    if (node.parentId && !byId.has(node.parentId)) {
      return { ok: false, code: 'missing_parent' };
    }
  }

  for (const node of nodes) {
    const seen = new Set<string>();
    let current: CmsMenuTreeNode | undefined = node;
    while (current?.parentId) {
      if (seen.has(current.id)) {
        return { ok: false, code: 'cycle' };
      }
      seen.add(current.id);
      current = byId.get(current.parentId);
    }
  }

  return { ok: true };
}
