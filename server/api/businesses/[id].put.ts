import { defineEventHandler, readValidatedBody } from 'h3';
import { eq } from 'drizzle-orm';
import { useDrizzle } from '~/server/utils/drizzle';
import { tables } from '~/server/database/schema';
import { businessInsertSchema } from '~/shared/utils/schema'; // This schema might need adjustment for updates (e.g. all fields optional)

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing business ID' });
  }
  const businessId = parseInt(id, 10);
  if (isNaN(businessId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid business ID' });
  }

  // For updates, it's common to want all fields to be optional.
  // businessInsertSchema might enforce required fields if not careful.
  // Consider using .partial() for the update schema.
  const updateSchema = businessInsertSchema.partial();
  const body = await readValidatedBody(event, updateSchema.parse);

  if (Object.keys(body).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No update data provided' });
  }

  try {
    const db = useDrizzle();
    const result = await db
      .update(tables.businesses)
      .set({ ...body, updatedAt: new Date().toISOString() }) // Ensure updatedAt is updated
      .where(eq(tables.businesses.id, businessId))
      .returning();

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Business not found' });
    }

    return result[0];
  } catch (error) {
    // Handle potential database errors or other issues
    console.error('Error updating business:', error);
    throw createError({ statusCode: 500, statusMessage: 'Failed to update business' });
  }
});
