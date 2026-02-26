import { pgTable, text, serial, integer, boolean, timestamp, uuid, pgEnum, date, jsonb } from "drizzle-orm/pg-core";
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

export const userGenderEnum = pgEnum("user_gender", ["male", "female", "other"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  birthday: date("birthday"),
  userGender: userGenderEnum("user_gender"),
  address: text("address"),
  church: text("church"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  churchUnit: text("church_unit"),
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
  hidden: boolean("hidden").default(false).notNull(),
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
  isAnswered: boolean("is_answered").default(false).notNull(),
  answeredAt: timestamp("answered_at"),
  scriptureReference: text("scripture_reference"),
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

// ============================================
// Rejesus Integration Tables
// ============================================

// Chinese Union Traditional Bible
export const chineseUnionTrad = pgTable("chinese_union_trad", {
  verseId: integer("verse_id").primaryKey(),
  bookName: text("book_name").notNull(),
  bookNumber: integer("book_number"),
  chapter: integer("chapter").notNull(),
  verse: integer("verse").notNull(),
  text: text("text").notNull(),
});

// Blessing Verses
export const blessingVerses = pgTable("blessing_verses", {
  id: serial("id").primaryKey(),
  verseId: integer("verse_id").notNull(),
  bookName: text("book_name").notNull(),
  bookNumber: integer("book_number"),
  chapter: integer("chapter").notNull(),
  verse: integer("verse").notNull(),
  text: text("text").notNull(),
  blessingVerse: text("blessing_verse"),
  blessingType: text("blessing_type"),
  aiPastoralSafety: text("ai_pastoral_safety"),
  textNorm: text("text_norm"),
  upliftScore: integer("uplift_score"),
  emotionalFocus: text("emotional_focus"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Jesus 4 Seasons - Timeline of Jesus' life
export const jesus4Seasons = pgTable("jesus_4seasons", {
  id: serial("id").primaryKey(),
  displayOrder: integer("display_order").notNull().default(0),
  eventId: text("event_id"),
  dateMaybe: text("date_maybe"),
  dateStage: text("date_stage"),
  stageShort: text("stage_short"),
  season: text("season").notNull(),
  approximateDate: text("approximate_date"),
  location: text("location"),
  eventName: text("event_name").notNull(),
  eventCategory: text("event_category"),
  theologicalTheme: text("theological_theme"),
  jesusCharacter: text("jesus_character"),
  focus: text("focus"),
  gospelCenter: text("gospel_center"),
  scriptureOverview: text("scripture_overview"),
  scriptureMt: text("scripture_mt"),
  scriptureMk: text("scripture_mk"),
  scriptureLk: text("scripture_lk"),
  scriptureJn: text("scripture_jn"),
  scriptureStatus: text("scripture_status"),
  harmonyPrinciple: text("harmony_principle"),
  dateConfidence: text("date_confidence"),
  orderConfidence: text("order_confidence"),
  dataType: text("data_type"),
  categoryFiveMain: text("category_five_main"),
  categoryResearchBasis: text("category_research_basis"),
  teachingThemeResearch: text("teaching_theme_research"),
  categoryResearchDetail: text("category_research_detail"),
  teachingKingdomSecondary: text("teaching_kingdom_secondary"),
  parableSecondary: text("parable_secondary"),
  miracleSecondary: text("miracle_secondary"),
  categoryResearchFinal: text("category_research_final"),
  demonstrationSecondary: text("demonstration_secondary"),
  wisdomSecondary: text("wisdom_secondary"),
  humorSecondary: text("humor_secondary"),
  categoryResearchUltimate: text("category_research_ultimate"),
  categoryTags: text("category_tags"),
  ntCrossReference: text("nt_cross_reference"),
  ntCrossReferenceReason: text("nt_cross_reference_reason"),
  ntCrossReferenceEvent: text("nt_cross_reference_event"),
  ntCrossReferenceConclusion: text("nt_cross_reference_conclusion"),
  themeIndexResearch: text("theme_index_research"),
  otMessiahCrossRef: text("ot_messiah_cross_ref"),
  otScriptureQuoteJesus: text("ot_scripture_quote_jesus"),
  typologyPeople: text("typology_people"),
  otScriptureQuoteJesusExpanded: text("ot_scripture_quote_jesus_expanded"),
  typologyPrimaryLevel: text("typology_primary_level"),
  typologySecondaryLevel: text("typology_secondary_level"),
  gospelCenterMicroNarrative: text("gospel_center_micro_narrative"),
  gospelCenterOld: text("gospel_center_old"),
  userPainPointTags: text("user_pain_point_tags"),
  takeawayPhrase: text("takeaway_phrase"),
  userPainPointPrimary: text("user_pain_point_primary"),
  userPainPointSecondary: text("user_pain_point_secondary"),
});

// Jesus Daily Content
export const jesusDailyContent = pgTable("jesus_daily_content", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  month: integer("month").notNull(),
  eventId: text("event_id").notNull().unique(),
  eventName: text("event_name").notNull(),
  location: text("location"),
  scriptureOverview: text("scripture_overview"),
  aiDescription: text("ai_description").notNull(),
  imageUrl: text("image_url"),
  dateMaybe: text("date_maybe"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Devotional Notes
export const devotionalNotes = pgTable("devotional_notes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  verseReference: text("verse_reference").notNull(),
  verseText: text("verse_text").notNull(),
  theme: text("theme"),
  keyVerse: text("key_verse"),
  newUnderstanding: text("new_understanding"),
  promises: text("promises"),
  notes: text("notes"),
  titlePhrase: text("title_phrase"),
  heartbeatVerse: text("heartbeat_verse"),
  observation: text("observation"),
  coreInsightCategory: text("core_insight_category"),
  coreInsightNote: text("core_insight_note"),
  scholarsNote: text("scholars_note"),
  actionPlan: text("action_plan"),
  coolDownNote: text("cool_down_note"),
  readingPlanId: uuid("reading_plan_id").references(() => userReadingPlans.id),
  dayNumber: integer("day_number"),
  hidden: boolean("hidden").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Saved Verses
export const savedVerses = pgTable("saved_verses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  verseReference: text("verse_reference").notNull(),
  verseText: text("verse_text").notNull(),
  bookName: text("book_name").notNull(),
  chapter: integer("chapter").notNull(),
  verseStart: integer("verse_start").notNull(),
  verseEnd: integer("verse_end"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reading Plan Templates
export const readingPlanTemplates = pgTable("reading_plan_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("custom"),
  durationDays: integer("duration_days").notNull().default(365),
  isPublic: boolean("is_public").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Reading Plan Template Items
export const readingPlanTemplateItems = pgTable("reading_plan_template_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: uuid("template_id").references(() => readingPlanTemplates.id).notNull(),
  dayNumber: integer("day_number").notNull(),
  title: text("title"),
  bookName: text("book_name"),
  chapterStart: integer("chapter_start"),
  chapterEnd: integer("chapter_end"),
  verseStart: integer("verse_start"),
  verseEnd: integer("verse_end"),
  scriptureReference: text("scripture_reference"),
  notes: text("notes"),
});

// User Reading Plans
export const userReadingPlans = pgTable("user_reading_plans", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  templateId: uuid("template_id").references(() => readingPlanTemplates.id),
  name: text("name").notNull(),
  description: text("description"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  reminderEnabled: boolean("reminder_enabled").default(true),
  reminderMorning: text("reminder_morning").default("07:00"),
  reminderNoon: text("reminder_noon").default("12:00"),
  reminderEvening: text("reminder_evening").default("20:00"),
  totalDays: integer("total_days"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User Reading Progress
export const userReadingProgress = pgTable("user_reading_progress", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  planId: uuid("plan_id").references(() => userReadingPlans.id).notNull(),
  dayNumber: integer("day_number").notNull(),
  readingDate: date("reading_date").notNull(),
  scriptureReference: text("scripture_reference").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  devotionalNoteId: uuid("devotional_note_id").references(() => devotionalNotes.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groupingActivities = pgTable("grouping_activities", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  shortCode: text("short_code").notNull().unique(), // 4-digit code for joining
  title: text("title").notNull(),
  status: text("status").notNull().default("joining"), // joining, finished
  groupingMode: text("grouping_mode").notNull().default("bySize"),
  groupSize: integer("group_size").default(4),
  groupCount: integer("group_count").default(3),
  genderMode: text("gender_mode").notNull().default("mixed"),
  ownerId: uuid("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groupingParticipants = pgTable("grouping_participants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  activityId: uuid("activity_id").references(() => groupingActivities.id).notNull(),
  name: text("name").notNull(),
  gender: text("gender").notNull(), // M, F
  groupNumber: integer("group_number"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const insertGroupingActivitySchema = createInsertSchema(groupingActivities).omit({ id: true, createdAt: true });
export const insertGroupingParticipantSchema = createInsertSchema(groupingParticipants).omit({ id: true, joinedAt: true });

export type GroupingActivity = typeof groupingActivities.$inferSelect;
export type GroupingParticipant = typeof groupingParticipants.$inferSelect;
export type InsertGroupingActivity = z.infer<typeof insertGroupingActivitySchema>;
export type InsertGroupingParticipant = z.infer<typeof insertGroupingParticipantSchema>;

export const prayerMeetingStatusEnum = pgEnum("prayer_meeting_status", ["joining", "grouped", "praying", "completed"]);
export const prayerMeetingGenderModeEnum = pgEnum("prayer_meeting_gender_mode", ["mixed", "separate", "male_only", "female_only"]);

export const prayerMeetings = pgTable("prayer_meetings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  shortCode: text("short_code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("joining"),
  groupingMode: text("grouping_mode").notNull().default("bySize"),
  groupSize: integer("group_size").default(4),
  groupCount: integer("group_count").default(3),
  genderMode: text("gender_mode").notNull().default("mixed"),
  separateByGender: boolean("separate_by_gender").default(false),
  ownerId: uuid("owner_id").references(() => users.id),
  prayerReport: text("prayer_report"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const prayerMeetingParticipants = pgTable("prayer_meeting_participants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: uuid("meeting_id").references(() => prayerMeetings.id).notNull(),
  userId: uuid("user_id").references(() => users.id),
  name: text("name").notNull(),
  gender: text("gender").notNull(),
  groupNumber: integer("group_number"),
  prayerRequest: text("prayer_request"),
  urgentPrayer: text("urgent_prayer"),
  anonymousPrayer: text("anonymous_prayer"),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  prayerCategory: text("prayer_category"),
  isUrgent: boolean("is_urgent").default(false),
  anonymousPrayerCategory: text("anonymous_prayer_category"),
  isAnonymousPrayerUrgent: boolean("is_anonymous_prayer_urgent").default(false),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPrayerMeetingSchema = createInsertSchema(prayerMeetings).omit({ id: true, createdAt: true });
export const insertPrayerMeetingParticipantSchema = createInsertSchema(prayerMeetingParticipants).omit({ id: true, joinedAt: true, updatedAt: true });

export type PrayerMeeting = typeof prayerMeetings.$inferSelect;
export type PrayerMeetingParticipant = typeof prayerMeetingParticipants.$inferSelect;
export type InsertPrayerMeeting = z.infer<typeof insertPrayerMeetingSchema>;
export type InsertPrayerMeetingParticipant = z.infer<typeof insertPrayerMeetingParticipantSchema>;

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

// Rejesus Types
export type ChineseUnionTrad = typeof chineseUnionTrad.$inferSelect;
export type BlessingVerse = typeof blessingVerses.$inferSelect;
export type Jesus4Season = typeof jesus4Seasons.$inferSelect;
export type JesusDailyContent = typeof jesusDailyContent.$inferSelect;
export type DevotionalNote = typeof devotionalNotes.$inferSelect;
export type SavedVerse = typeof savedVerses.$inferSelect;
export type ReadingPlanTemplate = typeof readingPlanTemplates.$inferSelect;
export type ReadingPlanTemplateItem = typeof readingPlanTemplateItems.$inferSelect;
export type UserReadingPlan = typeof userReadingPlans.$inferSelect;
export type UserReadingProgress = typeof userReadingProgress.$inferSelect;

export const insertDevotionalNoteSchema = createInsertSchema(devotionalNotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSavedVerseSchema = createInsertSchema(savedVerses).omit({ id: true, createdAt: true });
export const insertReadingPlanTemplateSchema = createInsertSchema(readingPlanTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserReadingPlanSchema = createInsertSchema(userReadingPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserReadingProgressSchema = createInsertSchema(userReadingProgress).omit({ id: true, createdAt: true });

export type InsertDevotionalNote = z.infer<typeof insertDevotionalNoteSchema>;
export type InsertSavedVerse = z.infer<typeof insertSavedVerseSchema>;
export type InsertReadingPlanTemplate = z.infer<typeof insertReadingPlanTemplateSchema>;
export type InsertUserReadingPlan = z.infer<typeof insertUserReadingPlanSchema>;
export type InsertUserReadingProgress = z.infer<typeof insertUserReadingProgressSchema>;

export * from "./models/auth";
