import { drizzle } from 'drizzle-orm/d1';
export { sql, eq, and, or, isNotNull } from 'drizzle-orm'

import * as schema from '../database/schema';

export const tables = schema;

export function useDrizzle() {
  return drizzle(hubDatabase(), { schema })
}

