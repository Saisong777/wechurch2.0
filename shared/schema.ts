import { pgTable, text, serial, integer, boolean, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const sessionStatusEnum = pgEnum("session_status", ["waiting", "grouping", "studying", "verification", "completed"]);
export const genderEnum = pgEnum("gender", ["male", "female"]);
export const groupingMethodEnum = pgEnum("grouping_method", ["random", "gender-balanced"]);
export const reportTypeEnum = pgEnum("report_type", ["group", "overall"]);
export const reportStatusEnum = pgEnum("report_status", ["PENDING", "COMPLETED", "FAILED"]);
export const appRoleEnum = pgEnum("app_role", ["member", "leader", "future_leader", "admin"]);
export const insightCategoryEnum = pgEnum("insight_category_type", ["PROMISE", "COMMAND", "WARNING", "GOD_ATTRIBUTE"]);
export const prayerCategoryEnum = pgEnum("prayer_category", ["thanksgiving", "supplication", "praise", "other"]);
export const cardLevelEnum = pgEnum("card_level", ["easy", "medium", "hard"]);
export const gameModeEnum = pgEnum("game_mode", ["free", "turn"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  role: appRoleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  verseReference: text("verse_reference").notNull(),
  status: text("status").notNull().default("waiting"),
  groupSize: integer("group_size").default(4),
  groupingMethod: text("grouping_method").default("random"),
  ownerId: uuid("owner_id").references(() => users.id),
  shortCode: text("short_code").unique(),
  allowLatecomers: boolean("allow_latecomers").default(false).notNull(),
  icebreakerEnabled: boolean("icebreaker_enabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const participants = pgTable("participants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").references(() => sessions.id).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  gender: text("gender").notNull(),
  groupNumber: integer("group_number"),
  location: text("location").default("On-site").notNull(),
  readyConfirmed: boolean("ready_confirmed").default(false).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").references(() => sessions.id).notNull(),
  participantId: uuid("participant_id").references(() => participants.id).notNull(),
  groupNumber: integer("group_number").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  bibleVerse: text("bible_verse").notNull(),
  theme: text("theme").default(""),
  movingVerse: text("moving_verse").default(""),
  factsDiscovered: text("facts_discovered").default(""),
  traditionalExegesis: text("traditional_exegesis").default(""),
  inspirationFromGod: text("inspiration_from_god").default(""),
  applicationInLife: text("application_in_life").default(""),
  others: text("others").default(""),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const aiReports = pgTable("ai_reports", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").references(() => sessions.id).notNull(),
  reportType: text("report_type").notNull(),
  groupNumber: integer("group_number"),
  content: text("content").notNull(),
  status: text("status").default("COMPLETED").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studyResponses = pgTable("study_responses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid("session_id").references(() => sessions.id).notNull(),
  userId: uuid("user_id").notNull(),
  titlePhrase: text("title_phrase"),
  heartbeatVerse: text("heartbeat_verse"),
  observation: text("observation"),
  coreInsightCategory: text("core_insight_category"),
  coreInsightNote: text("core_insight_note"),
  scholarsNote: text("scholars_note"),
  actionPlan: text("action_plan"),
  coolDownNote: text("cool_down_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const potentialMembers = pgTable("potential_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  gender: text("gender"),
  userId: uuid("user_id").references(() => users.id),
  status: text("status").default("pending").notNull(),
  subscribed: boolean("subscribed").default(true).notNull(),
  firstJoinedAt: timestamp("first_joined_at").defaultNow().notNull(),
  lastSessionAt: timestamp("last_session_at").defaultNow().notNull(),
  sessionsCount: integer("sessions_count").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const featureToggles = pgTable("feature_toggles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  featureKey: text("feature_key").notNull().unique(),
  featureName: text("feature_name").notNull(),
  description: text("description"),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  disabledMessage: text("disabled_message").default("即將推出"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
});

export const prayers = pgTable("prayers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  category: text("category").default("other").notNull(),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const prayerAmens = pgTable("prayer_amens", {
  prayerId: uuid("prayer_id").references(() => prayers.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const prayerComments = pgTable("prayer_comments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  prayerId: uuid("prayer_id").references(() => prayers.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const prayerNotifications = pgTable("prayer_notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  prayerId: uuid("prayer_id").references(() => prayers.id).notNull(),
  type: text("type").notNull(),
  actorName: text("actor_name"),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cardQuestions = pgTable("card_questions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contentText: text("content_text").notNull(),
  contentTextEn: text("content_text_en"),
  level: text("level").notNull(),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const icebreakerGames = pgTable("icebreaker_games", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  roomCode: text("room_code").notNull(),
  status: text("status").notNull().default("waiting"),
  mode: text("mode").default("free").notNull(),
  currentLevel: text("current_level"),
  currentCardId: text("current_card_id"),
  usedCardIds: text("used_card_ids").array(),
  passCount: integer("pass_count").default(0),
  bibleStudySessionId: uuid("bible_study_session_id").references(() => sessions.id),
  groupNumber: integer("group_number"),
  timerDuration: integer("timer_duration").default(60),
  timerStartedAt: timestamp("timer_started_at"),
  timerRunning: boolean("timer_running").default(false),
  sharingMode: boolean("sharing_mode").default(false).notNull(),
  sharedMemberIds: text("shared_member_ids").array(),
  currentDrawerId: text("current_drawer_id"),
  currentDrawerCardId: text("current_drawer_card_id"),
  drawerOrder: text("drawer_order").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const icebreakerPlayers = pgTable("icebreaker_players", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: uuid("game_id").references(() => icebreakerGames.id).notNull(),
  participantId: uuid("participant_id").references(() => participants.id),
  displayName: text("display_name").notNull(),
  gender: text("gender"),
  isActive: boolean("is_active").default(true),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const messageCards = pgTable("message_cards", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  shortCode: text("short_code").notNull().unique(),
  imagePath: text("image_path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
});

export const messageCardDownloads = pgTable("message_card_downloads", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  cardId: uuid("card_id").references(() => messageCards.id).notNull(),
  userId: uuid("user_id").references(() => users.id),
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  downloadedAt: timestamp("downloaded_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true });
export const insertParticipantSchema = createInsertSchema(participants).omit({ id: true, joinedAt: true, updatedAt: true });
export const insertSubmissionSchema = createInsertSchema(submissions).omit({ id: true, submittedAt: true });
export const insertStudyResponseSchema = createInsertSchema(studyResponses).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPrayerSchema = createInsertSchema(prayers).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type StudyResponse = typeof studyResponses.$inferSelect;
export type InsertStudyResponse = z.infer<typeof insertStudyResponseSchema>;
export type Prayer = typeof prayers.$inferSelect;
export type InsertPrayer = z.infer<typeof insertPrayerSchema>;
export type AiReport = typeof aiReports.$inferSelect;
export type FeatureToggle = typeof featureToggles.$inferSelect;
export type PotentialMember = typeof potentialMembers.$inferSelect;
export type IcebreakerGame = typeof icebreakerGames.$inferSelect;
export type IcebreakerPlayer = typeof icebreakerPlayers.$inferSelect;
export type CardQuestion = typeof cardQuestions.$inferSelect;
export type MessageCard = typeof messageCards.$inferSelect;

export * from "./models/auth";
