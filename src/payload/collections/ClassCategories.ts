import type { CollectionConfig } from 'payload';
import {
  authenticatedCmsAccess,
  sailingClassesManageAccess,
} from '@/payload/access';

/**
 * Fields needed for class catalog grouping and ClassDetailView category props.
 */
export const ClassCategories: CollectionConfig = {
  slug: 'class-categories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'isVisible', 'displayOrder'],
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
  ],
  timestamps: true,
  versions: false,
};
