import * as z from 'zod';
import { parseCmsHomeOverviewBody } from '@/libs/mit-sailing/cmsHomeOverview';
import { isSafeCmsAppPath, safeCmsHref } from '@/libs/mit-sailing/cmsHref';
import { parseCmsPricingBody } from '@/libs/mit-sailing/cmsPricing';
import { catalogUrlFragmentSlugSchema } from '@/libs/validation/catalogUrlFragmentSlugSchema';
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

/**
 * Validates and canonicalizes a CMS block image path for public page DTO emission.
 *
 * @param value - Raw image path from published CMS content
 * @returns Canonical safe path, or `undefined` when missing or invalid
 */
export function safePublicCmsBlockImageSrc(
  value: string | null | undefined
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = cmsImagePathSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

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

const optionalTrimmedStringSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

function normalizedVisibleCmsUrl(
  value: string | undefined,
  isShown: boolean
): string | undefined {
  if (!isShown) {
    return undefined;
  }
  if (!value) {
    return undefined;
  }
  const parsed = cmsUrlSchema.safeParse(value);
  return parsed.success ? parsed.data : value;
}

function normalizedVisibleCmsImagePath(
  value: string | undefined,
  isShown: boolean
): string | undefined {
  if (!isShown) {
    return undefined;
  }
  if (!value) {
    return undefined;
  }
  const parsed = cmsImagePathSchema.safeParse(value);
  return parsed.success ? parsed.data : value;
}

function hasOptionalCmsPairValue(
  first: string | undefined,
  second: string | undefined
): boolean {
  return Boolean(first ?? second);
}

function cmsBlockShowCta(value: {
  ctaLabel?: string;
  ctaUrl?: string;
  showCta?: boolean;
}): boolean {
  return value.showCta ?? hasOptionalCmsPairValue(value.ctaLabel, value.ctaUrl);
}

function cmsBlockShowImage(value: {
  imageAlt?: string;
  imageSrc?: string;
  showImage?: boolean;
}): boolean {
  return (
    value.showImage ?? hasOptionalCmsPairValue(value.imageSrc, value.imageAlt)
  );
}

function addCmsBlockIssue(
  ctx: z.RefinementCtx,
  message: AdminCatalogResourceMessageKey,
  path: string
) {
  ctx.addIssue({ code: 'custom', message, path: [path] });
}

function validateCmsBlockCtaGroup(
  value: { ctaLabel?: string; ctaUrl?: string; showCta?: boolean },
  ctx: z.RefinementCtx
) {
  if (!cmsBlockShowCta(value)) {
    return;
  }
  if (Boolean(value.ctaLabel) !== Boolean(value.ctaUrl)) {
    addCmsBlockIssue(
      ctx,
      value.ctaLabel
        ? cmsValidationMessages.ctaUrlRequired
        : cmsValidationMessages.ctaLabelRequired,
      value.ctaLabel ? 'ctaUrl' : 'ctaLabel'
    );
    return;
  }
  if (value.ctaUrl && !cmsUrlSchema.safeParse(value.ctaUrl).success) {
    addCmsBlockIssue(ctx, cmsValidationMessages.url, 'ctaUrl');
  }
}

function validateCmsBlockImageGroup(
  value: { imageAlt?: string; imageSrc?: string; showImage?: boolean },
  ctx: z.RefinementCtx
) {
  if (!cmsBlockShowImage(value)) {
    return;
  }
  if (Boolean(value.imageSrc) !== Boolean(value.imageAlt)) {
    addCmsBlockIssue(
      ctx,
      value.imageSrc
        ? cmsValidationMessages.imageAltRequired
        : cmsValidationMessages.imageSrcRequired,
      value.imageSrc ? 'imageAlt' : 'imageSrc'
    );
    return;
  }
  if (value.imageSrc && !cmsImagePathSchema.safeParse(value.imageSrc).success) {
    addCmsBlockIssue(ctx, cmsValidationMessages.imagePath, 'imageSrc');
  }
}

function validateCmsBlockStructuredBody(
  value: { body?: string; kind: string },
  ctx: z.RefinementCtx
) {
  if (value.kind === 'pricing' && !parseCmsPricingBody(value.body)) {
    addCmsBlockIssue(ctx, cmsValidationMessages.pricingBody, 'body');
  }
  if (value.kind !== 'home_overview') {
    return;
  }
  const homeOverview = parseCmsHomeOverviewBody(value.body);
  if (!homeOverview) {
    addCmsBlockIssue(ctx, cmsValidationMessages.homeOverviewBody, 'body');
    return;
  }
  if (!safeCmsHref(homeOverview.eventsCtaUrl)) {
    addCmsBlockIssue(
      ctx,
      cmsValidationMessages.homeOverviewEventsCtaUrl,
      'body'
    );
  }
}

export const cmsPageInputSchema = z.object({
  slug: catalogUrlFragmentSlugSchema,
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
    subtitle: optionalTrimmedStringSchema,
    body: optionalTrimmedStringSchema,
    ctaLabel: optionalTrimmedStringSchema,
    ctaUrl: optionalTrimmedStringSchema,
    showCta: z.boolean().optional(),
    imageSrc: optionalTrimmedStringSchema,
    imageAlt: optionalTrimmedStringSchema,
    showImage: z.boolean().optional(),
    isVisible: z.boolean(),
  })
  .superRefine((value, ctx) => {
    validateCmsBlockCtaGroup(value, ctx);
    validateCmsBlockImageGroup(value, ctx);
    validateCmsBlockStructuredBody(value, ctx);
  })
  .transform((value) => {
    const showCta = cmsBlockShowCta(value);
    const showImage = cmsBlockShowImage(value);
    return {
      ...value,
      ctaLabel: showCta ? value.ctaLabel : undefined,
      ctaUrl: normalizedVisibleCmsUrl(value.ctaUrl, showCta),
      imageAlt: showImage ? value.imageAlt : undefined,
      imageSrc: normalizedVisibleCmsImagePath(value.imageSrc, showImage),
      showCta,
      showImage,
    };
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
