import { pgTable, uuid, text, boolean, timestamp, integer, date, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users, smallGroups } from './schema';

export const supportDestinations = pgTable('support_destinations', {
  id: uuid('id').primaryKey().defaultRandom(), name: text('name').notNull(), church: text('church').notNull(),
  ownerId: uuid('owner_id').notNull().references(() => users.id), isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').notNull().references(() => users.id), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const supportRequests = pgTable('support_requests', {
  id: uuid('id').primaryKey(), senderId: uuid('sender_id').notNull().references(() => users.id), receiverId: uuid('receiver_id').notNull().references(() => users.id),
  groupId: uuid('group_id').references(() => smallGroups.id), destinationId: uuid('destination_id').references(() => supportDestinations.id),
  title: text('title').notNull(), body: text('body').notNull(), status: text('status').notNull().default('open'),
  nextAction: text('next_action').notNull().default(''), dueDate: date('due_date'), version: integer('version').notNull().default(1),
  consentAt: timestamp('consent_at', { withTimezone: true }).notNull().defaultNow(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('support_requests_sender_idx').on(t.senderId, t.updatedAt.desc()), index('support_requests_receiver_idx').on(t.receiverId, t.status, t.updatedAt.desc()), check('support_requests_target_check', sql`(${t.groupId} IS NULL) <> (${t.destinationId} IS NULL)`), check('support_requests_sender_check', sql`${t.senderId} <> ${t.receiverId}`), check('support_requests_version_check', sql`${t.version} > 0`), check('support_requests_status_check', sql`${t.status} IN ('open','accepted','waiting_requester','waiting_support','completed','declined','cancelled')`)]);
export const supportEvents = pgTable('support_events', {
  id: uuid('id').primaryKey(), requestId: uuid('request_id').notNull().references(() => supportRequests.id), authorId: uuid('author_id').notNull().references(() => users.id),
  body: text('body').notNull(), isPrivate: boolean('is_private').notNull().default(false), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('support_events_request_idx').on(t.requestId, t.createdAt)]);
export const supportDestinationAudit = pgTable('support_destination_audit', {
  id: uuid('id').primaryKey().defaultRandom(), destinationId: uuid('destination_id').notNull().references(() => supportDestinations.id),
  actorId: uuid('actor_id').notNull().references(() => users.id), action: text('action').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
