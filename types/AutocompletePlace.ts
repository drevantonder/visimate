import { z } from 'zod';

export const autocompletePlaceSchema = z.object({
  id: z.string(),
  title: z.string(),
  types: z.array(z.string()),
  description: z.string(),
});

export type AutocompletePlace = z.infer<typeof autocompletePlaceSchema>;
