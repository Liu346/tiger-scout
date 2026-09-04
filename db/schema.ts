import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const scoutingRecords = sqliteTable('scouting_records', {
  id: text('id').primaryKey(),
  event: text('event').notNull(),
  matchNumber: text('match_number').notNull(),
  team: text('team').notNull(),
  scout: text('scout'),
  alliance: text('alliance'),
  payload: text('payload').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, table => [
  index('idx_records_event').on(table.event),
  index('idx_records_team').on(table.team),
  index('idx_records_updated').on(table.updatedAt),
]);
