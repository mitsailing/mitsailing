import type {
  DefaultNodeTypes,
  SerializedLinkNode,
} from '@payloadcms/richtext-lexical';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import { LinkJSXConverter, RichText } from '@payloadcms/richtext-lexical/react';
import type { JSXConvertersFunction } from '@payloadcms/richtext-lexical/react';
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
 * Resolves Lexical internal document links to public app paths.
 *
 * @param args - Serialized link node wrapper
 * @returns Public href for the linked document
 */
function internalDocToHref(args: { linkNode: SerializedLinkNode }): string {
  const { doc } = args.linkNode.fields;
  if (!doc) {
    return '#';
  }
  const slug = slugFromDocValue(doc.value);
  if (!slug) {
    return '#';
  }
  switch (doc.relationTo) {
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

function CmsLexicalAnchor(props: {
  children: React.ReactNode;
  href: string;
  rel?: string;
  target?: string;
}) {
  const href = safeCmsHref(props.href);
  if (!href) {
    return <span>{props.children}</span>;
  }
  if (isAppRelativeCmsHref(href)) {
    return (
      <Link href={href} rel={props.rel} target={props.target}>
        {props.children}
      </Link>
    );
  }
  const external = externalCmsLinkProps(href);
  return (
    <a
      href={href}
      rel={props.rel ?? external.rel}
      target={props.target ?? external.target}
    >
      {props.children}
    </a>
  );
}

const jsxConverters: JSXConvertersFunction<DefaultNodeTypes> = ({
  defaultConverters,
}) => {
  const linkConverters = LinkJSXConverter({ internalDocToHref });
  return {
    ...defaultConverters,
    ...linkConverters,
    autolink: ({ node, nodesToJSX }) => {
      const children = nodesToJSX({ nodes: node.children });
      return (
        <CmsLexicalAnchor href={node.fields.url ?? '#'}>
          {children}
        </CmsLexicalAnchor>
      );
    },
    link: ({ node, nodesToJSX }) => {
      const children = nodesToJSX({ nodes: node.children });
      let href = node.fields.url ?? '';
      if (node.fields.linkType === 'internal') {
        href = internalDocToHref({ linkNode: node });
      }
      const rel = node.fields.newTab ? 'noopener noreferrer' : undefined;
      const target = node.fields.newTab ? '_blank' : undefined;
      return (
        <CmsLexicalAnchor href={href} rel={rel} target={target}>
          {children}
        </CmsLexicalAnchor>
      );
    },
  };
};

/**
 * Renders a Payload Lexical page body with app Link for internal paths.
 *
 * Upload defaults: image → `<img>`; PDF/other → filename link.
 *
 * @param props - Lexical editor state and optional className
 * @returns Rich text output for public pages
 */
export function PayloadLexicalRichText(props: {
  className?: string;
  data: SerializedEditorState;
}) {
  return (
    <RichText
      className={props.className}
      converters={jsxConverters}
      data={props.data}
    />
  );
}
