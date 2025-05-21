import { createUpdateSchema } from 'drizzle-zod';

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, z.object({ id: z.coerce.number() }).parse);
  const body = await readValidatedBody(event, createUpdateSchema(tables.businesses).parse);

  if (Object.keys(body).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No update data provided' });
  }

  try {
    const db = useDrizzle();
    const result = await db
      .update(tables.businesses)
      .set({ ...body, updatedAt: new Date().toISOString() }) // Ensure updatedAt is updated
      .where(eq(tables.businesses.id, id))
      .returning();

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Business not found' });
    }

    return result[0];
  } catch (error) {
    console.error('Error updating business:', error);
    throw createError({ statusCode: 500, statusMessage: 'Failed to update business' });
  }
});
