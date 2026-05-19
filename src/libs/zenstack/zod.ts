import { createSchemaFactory } from '@zenstackhq/zod';
import * as z from 'zod';
import { schema } from '../../../zenstack/schema';

const zodFactory = createSchemaFactory(schema);

function publicEventCategorySchema() {
  return zodFactory
    .makeModelSchema('EventCategory', {
      select: {
        isVisible: true,
        name: true,
      },
    })
    .extend({
      name: z.string().trim().min(1),
    });
}

export const eventCategoryCreateSchema = publicEventCategorySchema();

export const eventCategoryUpdateSchema = publicEventCategorySchema();

export const eventCategoryFormSchema = publicEventCategorySchema();
