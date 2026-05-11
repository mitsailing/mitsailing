import * as z from 'zod';
import { parseCmsHomeOverviewBody } from '@/libs/mit-sailing/cmsHomeOverview';
import { isSafeCmsAppPath, safeCmsHref } from '@/libs/mit-sailing/cmsHref';
import { parseCmsPricingBody } from '@/libs/mit-sailing/cmsPricing';
import type messages from '@/locales/en.json';

type AdminCatalogResourceMessageKey =
  keyof typeof messages.AdminCatalogResource;

const cmsValidationMessages = {
  ctaLabelRequired: 'field_error_cms_cta_label_required',
  ctaUrlRequired: 'field_error_cms_cta_url_required',
  homeOverviewBody: 'field_error_cms_home_overview_body',
  homeOverviewEventsCtaUrl: 'field_error_cms_home_overview_events_cta_url',
  imageAltRequired: 'field_error_cms_image_alt_required',
  imagePath: 'field_error_cms_image_path_safe_path',
  imageSrcRequired: 'field_error_cms_image_src_required',
  path: 'field_error_cms_path_safe_path',
  pricingBody: 'field_error_cms_pricing_body',
  url: 'field_error_cms_url_safe_href',
} satisfies Record<string, AdminCatalogResourceMessageKey>;

function canonicalCmsAppPath(path: string): string {
  return path === '/' ? path : path.replace(/\/+$/u, '');
}

/**
 * Index of the first `?` or `#`, or the string length when neither is present.
 *
 * @param value - App-relative href to measure
 * @returns End index of the path segment (exclusive)
 */
function cmsHrefPathPartEndIndex(value: string): number {
  const queryIndex = value.indexOf('?');
  const fragmentIndex = value.indexOf('#');
  if (queryIndex === -1) {
    return fragmentIndex === -1 ? value.length : fragmentIndex;
  }
  if (fragmentIndex === -1) {
    return queryIndex;
  }
  return Math.min(queryIndex, fragmentIndex);
}

/**
 * Strips trailing slashes from the path segment only; leaves query and fragment bytes unchanged.
 *
 * @param href - CMS href starting with `/` or any non-app-relative value (returned unchanged)
 * @returns Canonicalized href string
 */
function canonicalizeAppRelativeCmsHref(href: string): string {
  if (!href.startsWith('/')) {
    return href;
  }
  const end = cmsHrefPathPartEndIndex(href);
  const pathPart = href.slice(0, end);
  const rest = href.slice(end);
  return canonicalCmsAppPath(pathPart) + rest;
}

const cmsPathSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => isSafeCmsAppPath(value), cmsValidationMessages.path)
  .transform((value) => canonicalCmsAppPath(value));

const cmsImagePathSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => isSafeCmsAppPath(value), cmsValidationMessages.imagePath)
  .transform((value) => canonicalCmsAppPath(value));

const cmsUrlSchema = z.string().transform((value, ctx) => {
  const href = safeCmsHref(value);
  if (!href) {
    ctx.addIssue({
      code: 'custom',
      message: cmsValidationMessages.url,
    });
    return z.NEVER;
  }
  return canonicalizeAppRelativeCmsHref(href);
});

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
        message: value.ctaLabel
          ? cmsValidationMessages.ctaUrlRequired
          : cmsValidationMessages.ctaLabelRequired,
        path: value.ctaLabel ? ['ctaUrl'] : ['ctaLabel'],
      });
    }
    if (Boolean(value.imageSrc) !== Boolean(value.imageAlt)) {
      ctx.addIssue({
        code: 'custom',
        message: value.imageSrc
          ? cmsValidationMessages.imageAltRequired
          : cmsValidationMessages.imageSrcRequired,
        path: value.imageSrc ? ['imageAlt'] : ['imageSrc'],
      });
    }
    if (value.kind === 'pricing' && !parseCmsPricingBody(value.body)) {
      ctx.addIssue({
        code: 'custom',
        message: cmsValidationMessages.pricingBody,
        path: ['body'],
      });
    }
    if (value.kind === 'home_overview') {
      const homeOverview = parseCmsHomeOverviewBody(value.body);
      if (!homeOverview) {
        ctx.addIssue({
          code: 'custom',
          message: cmsValidationMessages.homeOverviewBody,
          path: ['body'],
        });
        return;
      }
      if (!safeCmsHref(homeOverview.eventsCtaUrl)) {
        ctx.addIssue({
          code: 'custom',
          message: cmsValidationMessages.homeOverviewEventsCtaUrl,
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
