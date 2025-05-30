import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';

export const businesses = sqliteTable('businesses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  // Social media and online presence fields (business-wide)
  websiteUrl: text('website_url'),
  facebookUsername: text('facebook_url'),
  instagramUsername: text('instagram_username'),
  tiktokUsername: text('tiktok_username'),
  xUsername: text('x_username'),
  linkedinUrl: text('linkedin_url'),
  youtubeUrl: text('youtube_url'),
  // Delivery platform URLs (business-wide)
  uberEatsUrl: text('uber_eats_url'),
  doorDashUrl: text('door_dash_url'),
  deliverooUrl: text('deliveroo_url'),
  menulogUrl: text('menulog_url'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const businessLocations = sqliteTable('business_locations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  businessId: integer('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  googlePlaceId: text('google_place_id'),
  appleMapsId: text('apple_maps_id'),
  name: text('name'),
  address: text('address'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const businessesRelations = relations(businesses, ({ many }) => ({
  locations: many(businessLocations),
}));

export const businessLocationsRelations = relations(businessLocations, ({ one }) => ({
  business: one(businesses, {
    fields: [businessLocations.businessId],
    references: [businesses.id],
  }),
}));
