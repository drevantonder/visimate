import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const businesses = sqliteTable('businesses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  placeId: text('place_id'),
  websiteUrl: text('website_url'),
  facebookUsername: text('facebook_username'),
  instagramUsername: text('instagram_username'),
  xUsername: text('x_username'),
  tiktokUsername: text('tiktok_username'),
  youtubeUsername: text('youtube_username'),
  uberEatsUrl: text('uber_eats_url'),
  doorDashUrl: text('door_dash_url'),
  deliverooUrl: text('deliveroo_url'),
  menulogUrl: text('menulog_url'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
