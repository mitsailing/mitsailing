import type { Block, Field, GroupField } from 'payload';
import { blockLexicalEditor } from '@/payload/blocks/lexicalEditor';

const LINK_COLLECTIONS = ['pages', 'boats', 'classes'] as const;

const COLUMN_WIDTHS = [
  { label: 'One third', value: 'oneThird' },
  { label: 'Half', value: 'half' },
  { label: 'Two thirds', value: 'twoThirds' },
  { label: 'Full', value: 'full' },
] as const;

function pageRichTextField(): Field {
  return {
    name: 'richText',
    type: 'richText',
    label: 'Text',
    editor: blockLexicalEditor(),
  };
}

/**
 * Internal-document or custom-URL link. Shown on media content only when Link is checked.
 *
 * @param props - Hide the group until the sibling `enableLink` checkbox is on
 * @returns Payload group field
 */
export function pageLinkField(props?: {
  whenEnableLink?: boolean;
}): GroupField {
  return {
    name: 'link',
    type: 'group',
    label: 'Link',
    ...(props?.whenEnableLink
      ? {
          admin: {
            condition: (
              _data: unknown,
              siblingData: { enableLink?: unknown }
            ) => Boolean(siblingData?.enableLink),
          },
        }
      : {}),
    fields: [
      {
        name: 'label',
        type: 'text',
        label: 'Label',
        required: true,
      },
      {
        name: 'linkType',
        type: 'radio',
        label: 'Link type',
        defaultValue: 'custom',
        options: [
          { label: 'Custom URL', value: 'custom' },
          { label: 'Internal link', value: 'internal' },
        ],
        required: true,
      },
      {
        name: 'url',
        type: 'text',
        label: 'URL',
        admin: {
          condition: (_, siblingData) => siblingData?.linkType !== 'internal',
        },
      },
      {
        name: 'doc',
        type: 'relationship',
        label: 'Document',
        relationTo: [...LINK_COLLECTIONS],
        admin: {
          condition: (_, siblingData) => siblingData?.linkType === 'internal',
        },
      },
      {
        name: 'newTab',
        type: 'checkbox',
        label: 'Open in new tab',
      },
    ],
  };
}

/**
 * Image beside text. `mediaContent` is image then text; `contentMedia` is text then image.
 */
export const MediaContent: Block = {
  slug: 'mediaContent',
  labels: {
    singular: 'Media and content',
    plural: 'Media and content',
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'alignment',
          type: 'select',
          label: 'Alignment',
          defaultValue: 'mediaContent',
          admin: {
            description: 'Choose how to align the content for this block.',
            width: '50%',
          },
          options: [
            { label: 'Media + Content', value: 'mediaContent' },
            { label: 'Content + Media', value: 'contentMedia' },
          ],
        },
        {
          name: 'mediaWidth',
          type: 'select',
          label: 'Media width',
          defaultValue: 'stretch',
          admin: {
            description: 'Stretch uses the column width. Fit stays inside it.',
            width: '50%',
          },
          options: [
            { label: 'Stretch', value: 'stretch' },
            { label: 'Fit', value: 'fit' },
          ],
        },
      ],
    },
    pageRichTextField(),
    {
      name: 'enableLink',
      type: 'checkbox',
      label: 'Link',
    },
    pageLinkField({ whenEnableLink: true }),
    {
      name: 'images',
      type: 'array',
      label: 'Images',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
  ],
};

/**
 * A row of text columns. Below the `md` breakpoint the public page stacks them.
 */
export const Content: Block = {
  slug: 'content',
  labels: {
    singular: 'Content',
    plural: 'Content',
  },
  fields: [
    {
      name: 'columns',
      type: 'array',
      label: 'Columns',
      fields: [
        {
          name: 'size',
          type: 'select',
          label: 'Width',
          defaultValue: 'oneThird',
          options: [...COLUMN_WIDTHS],
        },
        pageRichTextField(),
      ],
    },
  ],
};

/**
 * One full-width image.
 */
export const MediaBlock: Block = {
  slug: 'media',
  labels: {
    singular: 'Media',
    plural: 'Media',
  },
  fields: [
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'Image',
    },
  ],
};

/**
 * Text plus one link.
 */
export const CallToAction: Block = {
  slug: 'cta',
  labels: {
    singular: 'Call to action',
    plural: 'Calls to action',
  },
  fields: [pageRichTextField(), pageLinkField()],
};
