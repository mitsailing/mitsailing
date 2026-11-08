import type { CollectionConfig } from 'payload';
import { authenticatedCmsAccess, cmsEditAccess } from '@/payload/access';

const MENU_LOCATIONS = [
  { label: 'Header', value: 'header' },
  { label: 'Mobile utility', value: 'mobile_utility' },
  { label: 'Footer', value: 'footer' },
  { label: 'Legal', value: 'legal' },
  { label: 'Social', value: 'social' },
] as const;

const SYSTEM_KEYS = [
  { label: 'Classes', value: 'classes' },
  { label: 'Fleet', value: 'fleet' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Facebook', value: 'facebook' },
] as const;

/**
 * Site chrome menus. Auth chrome stays in React; no signed-in menu location.
 */
export const Menus: CollectionConfig = {
  slug: 'menus',
  admin: {
    useAsTitle: 'location',
    defaultColumns: ['location', 'updatedAt'],
  },
  access: {
    create: cmsEditAccess,
    delete: cmsEditAccess,
    read: authenticatedCmsAccess,
    update: cmsEditAccess,
  },
  fields: [
    {
      name: 'location',
      type: 'select',
      required: true,
      unique: true,
      options: [...MENU_LOCATIONS],
    },
    {
      name: 'items',
      type: 'array',
      labels: {
        singular: 'Item',
        plural: 'Items',
      },
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'linkType',
          type: 'select',
          required: true,
          defaultValue: 'url',
          options: [
            { label: 'Page', value: 'page' },
            { label: 'Boat', value: 'boat' },
            { label: 'Class', value: 'class' },
            { label: 'URL', value: 'url' },
          ],
        },
        {
          name: 'page',
          type: 'relationship',
          relationTo: 'pages',
          admin: {
            condition: (_, siblingData) => siblingData?.linkType === 'page',
          },
        },
        {
          name: 'boat',
          type: 'relationship',
          relationTo: 'boats',
          admin: {
            condition: (_, siblingData) => siblingData?.linkType === 'boat',
          },
        },
        {
          name: 'class',
          type: 'relationship',
          relationTo: 'classes',
          admin: {
            condition: (_, siblingData) => siblingData?.linkType === 'class',
          },
        },
        {
          name: 'url',
          type: 'text',
          admin: {
            condition: (_, siblingData) => siblingData?.linkType === 'url',
          },
        },
        {
          name: 'parent',
          type: 'text',
          admin: {
            description:
              'Optional parent item id (array row id) for nesting under another item.',
          },
        },
        {
          name: 'systemKey',
          type: 'select',
          options: [...SYSTEM_KEYS],
          admin: {
            description:
              'Optional system key for React-driven nav (classes, fleet, social).',
          },
        },
      ],
    },
  ],
  timestamps: true,
  versions: false,
};
