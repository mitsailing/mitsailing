import { createSchemaFactory } from '@zenstackhq/zod';
import * as z from 'zod';
import { schema } from '../../../zenstack/schema';

const zodFactory = createSchemaFactory(schema);

export const eventCategoryFormSchema = zodFactory
  .makeModelSchema('EventCategory', {
    select: {
      isVisible: true,
      name: true,
    },
  })
  .extend({
    name: z.string().trim().min(1),
  });
