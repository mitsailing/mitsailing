import type { CollectionConfig } from 'payload';
import {
  authenticatedCmsAccess,
  sailingClassesManageAccess,
} from '@/payload/access';

/**
 * Fields needed by ClassDetailView / catalog props (no public loaders changed).
 */
export const Classes: CollectionConfig = {
  slug: 'classes',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'level', 'category', 'isVisible'],
  },
  access: {
    create: sailingClassesManageAccess,
    delete: sailingClassesManageAccess,
    read: authenticatedCmsAccess,
    update: sailingClassesManageAccess,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'level',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'richText',
      required: true,
    },
    {
      name: 'images',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
    },
    {
      name: 'isVisible',
      type: 'checkbox',
      defaultValue: true,
      required: true,
    },
    {
      name: 'displayOrder',
      type: 'number',
      defaultValue: 0,
      required: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'class-categories',
      required: true,
    },
    {
      name: 'prerequisites',
      type: 'relationship',
      relationTo: 'classes',
      hasMany: true,
    },
    {
      name: 'unlockedBoats',
      type: 'relationship',
      relationTo: 'boats',
      hasMany: true,
    },
  ],
  timestamps: true,
  versions: false,
};
