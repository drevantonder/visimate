import { z } from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

import { tables} from '../../server/utils/drizzle'

export const businessInsertSchema = createInsertSchema(tables.businesses);
export const businessSchema = createSelectSchema(tables.businesses);

export type Business = z.infer<typeof businessSchema>;

export const businessLocationInsertSchema = createInsertSchema(tables.businessLocations);
export const businessLocationSchema = createSelectSchema(tables.businessLocations);
export type BusinessLocation = z.infer<typeof businessLocationSchema>;

// Business with locations type
export const businessWithLocationsSchema = businessSchema.extend({
  locations: z.array(businessLocationSchema),
});
export type BusinessWithLocations = z.infer<typeof businessWithLocationsSchema>;
