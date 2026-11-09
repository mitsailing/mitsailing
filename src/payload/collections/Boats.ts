import type { CollectionConfig } from 'payload';
import { fleetManageAccess, visibleCatalogReadAccess } from '@/payload/access';

/**
 * Fields needed by FleetBoatDetailView props.
 */
export const Boats: CollectionConfig = {
  slug: 'boats',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'type', 'capacity', 'isVisible'],
  },
  access: {
    create: fleetManageAccess,
    delete: fleetManageAccess,
    read: visibleCatalogReadAccess,
    update: fleetManageAccess,
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
      name: 'type',
      type: 'text',
      required: true,
    },
    {
      name: 'capacity',
      type: 'number',
      required: true,
      min: 1,
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
      name: 'requiredClass',
      type: 'relationship',
      relationTo: 'classes',
      required: true,
    },
  ],
  timestamps: true,
  versions: false,
};
