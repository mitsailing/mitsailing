import type { SerializedLinkNode } from '@payloadcms/richtext-lexical';
import { Link } from '@/libs/I18nNavigation';
import {
  externalCmsLinkProps,
  isAppRelativeCmsHref,
  safeCmsHref,
} from '@/libs/mit-sailing/cmsHref';
import { publicPathFromPageSlug } from '@/libs/payload/pagePaths';

function slugFromDocValue(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  if (!('slug' in value) || typeof value.slug !== 'string') {
    return null;
  }
  return value.slug;
}

/**
 * Resolves a Payload document relationship to a public app path.
 *
 * @param relationTo - Collection slug (`pages`, `boats`, or `classes`)
 * @param value - Populated document or unresolved id
 * @returns Public href, or `#` when the document has no slug
 */
function cmsDocumentHref(
  relationTo: string | undefined,
  value: unknown
): string {
  const slug = slugFromDocValue(value);
  if (!slug || relationTo === undefined) {
    return '#';
  }
  switch (relationTo) {
    case 'pages': {
      return publicPathFromPageSlug(slug);
    }
    case 'boats': {
      return `/fleet/${encodeURIComponent(slug)}`;
    }
    case 'classes': {
      return `/classes/${encodeURIComponent(slug)}`;
    }
    default: {
      return '#';
    }
  }
}

/**
 * Resolves Lexical internal document links to public app paths.
 *
 * @param args - Serialized link node wrapper
 * @returns Public href for the linked document
 */
export function internalDocToHref(args: {
  linkNode: SerializedLinkNode;
}): string {
  const { doc } = args.linkNode.fields;
  if (!doc) {
    return '#';
  }
  return cmsDocumentHref(doc.relationTo, doc.value);
}

/**
 * Renders an internal app link or a safe external anchor.
 *
 * @param props - Href, visible label, and optional new-tab attributes
 * @returns Anchor, or a span when the href is not safe
 */
export function CmsAnchor(props: {
  children: React.ReactNode;
  className?: string;
  href: string;
  rel?: string;
  target?: string;
}) {
  const href = safeCmsHref(props.href);
  if (!href) {
    return <span className={props.className}>{props.children}</span>;
  }
  if (isAppRelativeCmsHref(href)) {
    return (
      <Link
        className={props.className}
        href={href}
        rel={props.rel}
        target={props.target}
      >
        {props.children}
      </Link>
    );
  }
  const external = externalCmsLinkProps(href);
  return (
    <a
      className={props.className}
      href={href}
      rel={props.rel ?? external.rel}
      target={props.target ?? external.target}
    >
      {props.children}
    </a>
  );
}
