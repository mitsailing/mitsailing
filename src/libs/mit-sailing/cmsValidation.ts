import * as z from 'zod';
import { parseCmsHomeOverviewBody } from '@/libs/mit-sailing/cmsHomeOverview';
import { parseCmsPricingBody } from '@/libs/mit-sailing/cmsPricing';

const cmsPathSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => value.startsWith('/'), 'CMS paths must start with /')
  .refine(
    (value) => !value.startsWith('//'),
    'CMS paths must not be protocol-relative'
  )
  .refine(
    (value) => !value.includes('?'),
    'CMS paths must not include query strings'
  )
  .refine(
    (value) => !value.includes('#'),
    'CMS paths must not include fragments'
  )
  .transform((value) => {
    if (value === '/') {
      return value;
    }
    return value.endsWith('/') ? value : `${value}/`;
  });

const cmsUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    if (value === '#') {
      return true;
    }
    if (value.startsWith('/')) {
      return !value.startsWith('//');
    }
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }, 'CMS links must be internal paths, #, or http(s) URLs');

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
    imageSrc: z.string().trim().optional(),
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
    if (
      value.kind === 'home_overview' &&
      !parseCmsHomeOverviewBody(value.body)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'CMS home overview blocks require valid overview settings',
        path: ['body'],
      });
    }
  });

export const cmsMenuItemInputSchema = z
  .object({
    menuId: z.string().trim().min(1),
    parentId: z.string().trim().optional(),
    linkedPageId: z.string().trim().optional(),
    label: z.string().trim().min(1),
    url: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value === '' ? undefined : value)),
    isExternal: z.boolean(),
    isVisible: z.boolean(),
    displayOrder: z.number().int().min(0),
    systemKey: z.string().trim().optional(),
  })
  .refine(
    (value) => {
      if (!value.url) {
        return true;
      }
      return cmsUrlSchema.safeParse(value.url).success;
    },
    { message: 'CMS menu item URL is invalid', path: ['url'] }
  );

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
