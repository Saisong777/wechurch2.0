import { pgTable, text, serial, integer, boolean, timestamp, uuid, pgEnum, date, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const sessionStatusEnum = pgEnum("session_status", ["waiting", "grouping", "studying", "verification", "completed"]);
export const genderEnum = pgEnum("gender", ["male", "female"]);
export const groupingMethodEnum = pgEnum("grouping_method", ["random", "gender-balanced"]);
export const reportTypeEnum = pgEnum("report_type", ["group", "overall"]);
export const reportStatusEnum = pgEnum("report_status", ["PENDING", "COMPLETED", "FAILED"]);
export const appRoleEnum = pgEnum("app_role", [
  "member",
  "leader",
  "future_leader",
  "admin",
  "senior_pastor",
  "pastor",
  "minister",
  "group_leader",
]);
export const crmScopeTypeEnum = pgEnum("crm_scope_type", ["church", "group", "member"]);
export const insightCategoryEnum = pgEnum("insight_category_type", ["PROMISE", "COMMAND", "WARNING", "GOD_ATTRIBUTE"]);
export const prayerCategoryEnum = pgEnum("prayer_category", ["thanksgiving", "supplication", "praise", "other"]);
export const cardLevelEnum = pgEnum("card_level", ["easy", "medium", "hard"]);
export const gameModeEnum = pgEnum("game_mode", ["free", "turn"]);

export const userGenderEnum = pgEnum("user_gender", ["male", "female", "other"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"),
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

export const userEmailPreferences = pgTable("user_email_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id).notNull(),
  dailyFollowEnabled: boolean("daily_follow_enabled").default(false).notNull(),
  dailyFollowTime: text("daily_follow_time").default("07:00").notNull(),
  timezone: text("timezone").default("Asia/Taipei").notNull(),
  lastDailyFollowSentAt: timestamp("last_daily_follow_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const persons = pgTable("persons", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  displayName: text("display_name").notNull(),
  primaryEmail: text("primary_email"),
  church: text("church"),
  pastoralStage: text("pastoral_stage").default("unknown").notNull(),
  pastoralStatus: text("pastoral_status").default("active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  emailUnique: uniqueIndex("persons_primary_email_unique").on(table.primaryEmail),
  churchIdx: index("persons_church_idx").on(table.church),
  statusIdx: index("persons_pastoral_status_idx").on(table.pastoralStatus),
}));

export const personIdentityLinks = pgTable("person_identity_links", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: uuid("person_id").references(() => persons.id).notNull(),
  userId: uuid("user_id").references(() => users.id),
  participantId: uuid("participant_id").references(() => participants.id),
  potentialMemberId: uuid("potential_member_id").references(() => potentialMembers.id),
  careContactId: uuid("care_contact_id").references(() => careContacts.id),
  sourceType: text("source_type").notNull(),
  sourceLabel: text("source_label"),
  matchMethod: text("match_method").default("manual").notNull(),
  confidence: integer("confidence").default(100).notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  personIdx: index("person_identity_links_person_id_idx").on(table.personId),
  userUnique: uniqueIndex("person_identity_links_user_id_unique").on(table.userId),
  participantUnique: uniqueIndex("person_identity_links_participant_id_unique").on(table.participantId),
  potentialUnique: uniqueIndex("person_identity_links_potential_member_id_unique").on(table.potentialMemberId),
  careContactUnique: uniqueIndex("person_identity_links_care_contact_id_unique").on(table.careContactId),
  sourceIdx: index("person_identity_links_source_type_idx").on(table.sourceType),
}));

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
  icebreakerLevel: text("icebreaker_level").default("L1").notNull(),
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
  userId: uuid("user_id").notNull(), // stores participants.id (not users.id)
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
}, (table) => ({
  sessionUserUnique: uniqueIndex("study_responses_session_user_unique").on(table.sessionId, table.userId),
  sessionIdIdx: index("study_responses_session_id_idx").on(table.sessionId),
}));

export const potentialMembers = pgTable("potential_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  gender: text("gender"),
  church: text("church"),
  userId: uuid("user_id").references(() => users.id),
  status: text("status").default("pending").notNull(),
  subscribed: boolean("subscribed").default(true).notNull(),
  firstJoinedAt: timestamp("first_joined_at").defaultNow().notNull(),
  lastSessionAt: timestamp("last_session_at").defaultNow().notNull(),
  sessionsCount: integer("sessions_count").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const smallGroups = pgTable("small_groups", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  church: text("church").notNull(),
  name: text("name").notNull(),
  leaderUserId: uuid("leader_user_id").references(() => users.id),
  pastorUserId: uuid("pastor_user_id").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  churchIdx: index("small_groups_church_idx").on(table.church),
  leaderIdx: index("small_groups_leader_user_id_idx").on(table.leaderUserId),
}));

export const smallGroupMembers = pgTable("small_group_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: uuid("group_id").references(() => smallGroups.id).notNull(),
  userId: uuid("user_id").references(() => users.id),
  potentialMemberId: uuid("potential_member_id").references(() => potentialMembers.id),
  memberEmail: text("member_email"),
  isActive: boolean("is_active").default(true).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  groupIdx: index("small_group_members_group_id_idx").on(table.groupId),
  userIdx: index("small_group_members_user_id_idx").on(table.userId),
  emailIdx: index("small_group_members_member_email_idx").on(table.memberEmail),
}));

export const crmScopeAssignments = pgTable("crm_scope_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  assigneeUserId: uuid("assignee_user_id").references(() => users.id).notNull(),
  assignedByUserId: uuid("assigned_by_user_id").references(() => users.id),
  scopeType: crmScopeTypeEnum("scope_type").notNull(),
  church: text("church"),
  groupId: uuid("group_id").references(() => smallGroups.id),
  memberUserId: uuid("member_user_id").references(() => users.id),
  potentialMemberId: uuid("potential_member_id").references(() => potentialMembers.id),
  canViewPersonal: boolean("can_view_personal").default(false).notNull(),
  canManageCare: boolean("can_manage_care").default(false).notNull(),
  canManageMembers: boolean("can_manage_members").default(false).notNull(),
  note: text("note"),
  isActive: boolean("is_active").default(true).notNull(),
  startsAt: timestamp("starts_at").defaultNow().notNull(),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  assigneeIdx: index("crm_scope_assignments_assignee_user_id_idx").on(table.assigneeUserId),
  groupIdx: index("crm_scope_assignments_group_id_idx").on(table.groupId),
  churchIdx: index("crm_scope_assignments_church_idx").on(table.church),
}));

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

export const careContacts = pgTable("care_contacts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  relationship: text("relationship"),
  need: text("need").default("").notNull(),
  nextAction: text("next_action").default("").notNull(),
  prayer: text("prayer").default("").notNull(),
  source: text("source").default("personal").notNull(),
  visibility: text("visibility").default("private").notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  lastCaredAt: timestamp("last_cared_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("care_contacts_user_id_idx").on(table.userId),
  activeIdx: index("care_contacts_user_active_idx").on(table.userId, table.isArchived),
}));

export const careActions = pgTable("care_actions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: uuid("contact_id").references(() => careContacts.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  actionType: text("action_type").default("note").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  contactIdx: index("care_actions_contact_id_idx").on(table.contactId),
  userIdx: index("care_actions_user_id_idx").on(table.userId),
}));

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

export const appEvents = pgTable("app_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventName: text("event_name").notNull(),
  source: text("source").default("client").notNull(),
  path: text("path"),
  sessionId: uuid("session_id").references(() => sessions.id),
  participantId: uuid("participant_id").references(() => participants.id),
  userId: uuid("user_id").references(() => users.id),
  userEmail: text("user_email"),
  metadata: jsonb("metadata"),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  eventNameIdx: index("app_events_event_name_idx").on(table.eventName),
  createdAtIdx: index("app_events_created_at_idx").on(table.createdAt),
  sessionIdx: index("app_events_session_id_idx").on(table.sessionId),
}));

export const appErrorEvents = pgTable("app_error_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").default("server").notNull(),
  level: text("level").default("error").notNull(),
  message: text("message").notNull(),
  stack: text("stack"),
  path: text("path"),
  method: text("method"),
  statusCode: integer("status_code"),
  sessionId: uuid("session_id").references(() => sessions.id),
  participantId: uuid("participant_id").references(() => participants.id),
  userId: uuid("user_id").references(() => users.id),
  metadata: jsonb("metadata"),
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index("app_error_events_source_idx").on(table.source),
  createdAtIdx: index("app_error_events_created_at_idx").on(table.createdAt),
  statusIdx: index("app_error_events_status_code_idx").on(table.statusCode),
}));

export const aiUsageEvents = pgTable("ai_usage_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  feature: text("feature").notNull(),
  reportType: text("report_type"),
  sessionId: uuid("session_id").references(() => sessions.id),
  reportId: uuid("report_id").references(() => aiReports.id),
  groupNumber: integer("group_number"),
  inputChars: integer("input_chars").default(0).notNull(),
  outputChars: integer("output_chars").default(0).notNull(),
  latencyMs: integer("latency_ms").default(0).notNull(),
  status: text("status").notNull(),
  finishReason: text("finish_reason"),
  qualityScore: integer("quality_score"),
  retryCount: integer("retry_count").default(0).notNull(),
  estimatedCostUnits: integer("estimated_cost_units").default(0).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  featureIdx: index("ai_usage_events_feature_idx").on(table.feature),
  createdAtIdx: index("ai_usage_events_created_at_idx").on(table.createdAt),
  sessionIdx: index("ai_usage_events_session_id_idx").on(table.sessionId),
}));

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

export const journeyTemplates = pgTable("journey_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").default("discipleship").notNull(),
  durationDays: integer("duration_days").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const journeyDays = pgTable("journey_days", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: uuid("template_id").references(() => journeyTemplates.id).notNull(),
  dayNumber: integer("day_number").notNull(),
  title: text("title").notNull(),
  scriptureReference: text("scripture_reference"),
  bodyMarkdown: text("body_markdown"),
  actionPrompt: text("action_prompt"),
  reflectionPrompt: text("reflection_prompt"),
  discussionPrompt: text("discussion_prompt"),
  milestoneKey: text("milestone_key"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  templateDayUnique: uniqueIndex("journey_days_template_day_unique").on(table.templateId, table.dayNumber),
  templateIdx: index("journey_days_template_id_idx").on(table.templateId),
}));

export const personJourneys = pgTable("person_journeys", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: uuid("person_id").references(() => persons.id).notNull(),
  templateId: uuid("template_id").references(() => journeyTemplates.id).notNull(),
  mentorUserId: uuid("mentor_user_id").references(() => users.id),
  mentorPersonId: uuid("mentor_person_id").references(() => persons.id),
  status: text("status").default("active").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  privateNote: text("private_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  personIdx: index("person_journeys_person_id_idx").on(table.personId),
  templateIdx: index("person_journeys_template_id_idx").on(table.templateId),
  statusIdx: index("person_journeys_status_idx").on(table.status),
}));

export const journeyProgress = pgTable("journey_progress", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  personJourneyId: uuid("person_journey_id").references(() => personJourneys.id).notNull(),
  journeyDayId: uuid("journey_day_id").references(() => journeyDays.id).notNull(),
  dayNumber: integer("day_number").notNull(),
  status: text("status").default("not_started").notNull(),
  responseText: text("response_text"),
  mentorNote: text("mentor_note"),
  needsFollowUp: boolean("needs_follow_up").default(false).notNull(),
  visibility: text("visibility").default("pastoral").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  journeyDayUnique: uniqueIndex("journey_progress_journey_day_unique").on(table.personJourneyId, table.journeyDayId),
  journeyIdx: index("journey_progress_person_journey_id_idx").on(table.personJourneyId),
  followUpIdx: index("journey_progress_needs_follow_up_idx").on(table.needsFollowUp),
}));

export const journeyMilestones = pgTable("journey_milestones", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  personJourneyId: uuid("person_journey_id").references(() => personJourneys.id).notNull(),
  personId: uuid("person_id").references(() => persons.id).notNull(),
  milestoneKey: text("milestone_key").notNull(),
  title: text("title").notNull(),
  status: text("status").default("planned").notNull(),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  journeyIdx: index("journey_milestones_person_journey_id_idx").on(table.personJourneyId),
  personIdx: index("journey_milestones_person_id_idx").on(table.personId),
  statusIdx: index("journey_milestones_status_idx").on(table.status),
}));

export const mentorAssignments = pgTable("mentor_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: uuid("person_id").references(() => persons.id).notNull(),
  mentorUserId: uuid("mentor_user_id").references(() => users.id),
  mentorPersonId: uuid("mentor_person_id").references(() => persons.id),
  scope: text("scope").default("journey").notNull(),
  status: text("status").default("active").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  personIdx: index("mentor_assignments_person_id_idx").on(table.personId),
  mentorUserIdx: index("mentor_assignments_mentor_user_id_idx").on(table.mentorUserId),
  statusIdx: index("mentor_assignments_status_idx").on(table.status),
}));

export const pastoralTasks = pgTable("pastoral_tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: uuid("person_id").references(() => persons.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("open").notNull(),
  priority: text("priority").default("normal").notNull(),
  dueAt: timestamp("due_at"),
  assignedToUserId: uuid("assigned_to_user_id").references(() => users.id),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  sourceType: text("source_type"),
  sourceId: text("source_id"),
  visibility: text("visibility").default("pastoral").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  personIdx: index("pastoral_tasks_person_id_idx").on(table.personId),
  statusIdx: index("pastoral_tasks_status_idx").on(table.status),
  assigneeIdx: index("pastoral_tasks_assigned_to_user_id_idx").on(table.assignedToUserId),
  dueIdx: index("pastoral_tasks_due_at_idx").on(table.dueAt),
}));

export const personMergeSuggestions = pgTable("person_merge_suggestions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  primaryPersonId: uuid("primary_person_id").references(() => persons.id).notNull(),
  duplicatePersonId: uuid("duplicate_person_id").references(() => persons.id).notNull(),
  reason: text("reason").notNull(),
  confidence: integer("confidence").default(60).notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  primaryIdx: index("person_merge_suggestions_primary_person_id_idx").on(table.primaryPersonId),
  duplicateIdx: index("person_merge_suggestions_duplicate_person_id_idx").on(table.duplicatePersonId),
  statusIdx: index("person_merge_suggestions_status_idx").on(table.status),
  pairUnique: uniqueIndex("person_merge_suggestions_pair_unique").on(table.primaryPersonId, table.duplicatePersonId),
}));

export const servingTeams = pgTable("serving_teams", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  church: text("church"),
  name: text("name").notNull(),
  category: text("category").default("service").notNull(),
  description: text("description"),
  leaderUserId: uuid("leader_user_id").references(() => users.id),
  defaultLocation: text("default_location"),
  defaultStartTime: text("default_start_time"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  churchIdx: index("serving_teams_church_idx").on(table.church),
  leaderIdx: index("serving_teams_leader_user_id_idx").on(table.leaderUserId),
  activeIdx: index("serving_teams_active_idx").on(table.isActive),
}));

export const servingTeamMembers = pgTable("serving_team_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid("team_id").references(() => servingTeams.id).notNull(),
  personId: uuid("person_id").references(() => persons.id).notNull(),
  userId: uuid("user_id").references(() => users.id),
  roleLabel: text("role_label").default("同工").notNull(),
  status: text("status").default("active").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  teamIdx: index("serving_team_members_team_id_idx").on(table.teamId),
  personIdx: index("serving_team_members_person_id_idx").on(table.personId),
  userIdx: index("serving_team_members_user_id_idx").on(table.userId),
  teamPersonUnique: uniqueIndex("serving_team_members_team_person_unique").on(table.teamId, table.personId),
}));

export const servingRoles = pgTable("serving_roles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid("team_id").references(() => servingTeams.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  requiredCount: integer("required_count").default(1).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  teamIdx: index("serving_roles_team_id_idx").on(table.teamId),
  teamNameUnique: uniqueIndex("serving_roles_team_name_unique").on(table.teamId, table.name),
}));

export const servingScheduleEvents = pgTable("serving_schedule_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: uuid("team_id").references(() => servingTeams.id).notNull(),
  title: text("title").notNull(),
  serviceDate: date("service_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  location: text("location"),
  status: text("status").default("draft").notNull(),
  note: text("note"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  teamDateIdx: index("serving_schedule_events_team_date_idx").on(table.teamId, table.serviceDate),
  statusIdx: index("serving_schedule_events_status_idx").on(table.status),
}));

export const servingAssignments = pgTable("serving_assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: uuid("event_id").references(() => servingScheduleEvents.id).notNull(),
  roleId: uuid("role_id").references(() => servingRoles.id).notNull(),
  personId: uuid("person_id").references(() => persons.id).notNull(),
  userId: uuid("user_id").references(() => users.id),
  status: text("status").default("pending").notNull(),
  note: text("note"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  eventIdx: index("serving_assignments_event_id_idx").on(table.eventId),
  roleIdx: index("serving_assignments_role_id_idx").on(table.roleId),
  personIdx: index("serving_assignments_person_id_idx").on(table.personId),
  eventRolePersonUnique: uniqueIndex("serving_assignments_event_role_person_unique").on(table.eventId, table.roleId, table.personId),
}));

export const facilityRooms = pgTable("facility_rooms", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  church: text("church"),
  name: text("name").notNull(),
  category: text("category").default("classroom").notNull(),
  location: text("location"),
  capacity: integer("capacity").default(12).notNull(),
  description: text("description"),
  priority: integer("priority").default(50).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  churchIdx: index("facility_rooms_church_idx").on(table.church),
  activeIdx: index("facility_rooms_active_idx").on(table.isActive),
  roomUnique: uniqueIndex("facility_rooms_church_name_unique").on(table.church, table.name),
}));

export const facilityBookings = pgTable("facility_bookings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: uuid("room_id").references(() => facilityRooms.id).notNull(),
  church: text("church"),
  title: text("title").notNull(),
  purpose: text("purpose").default("small_group").notNull(),
  requesterPersonId: uuid("requester_person_id").references(() => persons.id),
  requesterUserId: uuid("requester_user_id").references(() => users.id),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  status: text("status").default("pending").notNull(),
  priority: integer("priority").default(50).notNull(),
  note: text("note"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  roomTimeIdx: index("facility_bookings_room_time_idx").on(table.roomId, table.startAt, table.endAt),
  churchIdx: index("facility_bookings_church_idx").on(table.church),
  statusIdx: index("facility_bookings_status_idx").on(table.status),
  requesterPersonIdx: index("facility_bookings_requester_person_id_idx").on(table.requesterPersonId),
}));

export const pastoralFrameworkStages = pgTable("pastoral_framework_stages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  sourceLabel: text("source_label"),
  isActive: boolean("is_active").default(true).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  activeIdx: index("pastoral_framework_stages_active_idx").on(table.isActive),
  sortIdx: index("pastoral_framework_stages_sort_order_idx").on(table.sortOrder),
}));

export const pastoralStageRequirements = pgTable("pastoral_stage_requirements", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  stageId: uuid("stage_id").references(() => pastoralFrameworkStages.id).notNull(),
  requirementType: text("requirement_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  targetCount: integer("target_count").default(1).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  stageIdx: index("pastoral_stage_requirements_stage_id_idx").on(table.stageId),
  typeIdx: index("pastoral_stage_requirements_type_idx").on(table.requirementType),
  stageTitleUnique: uniqueIndex("pastoral_stage_requirements_stage_title_unique").on(table.stageId, table.title),
}));

export const personStageProgress = pgTable("person_stage_progress", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  personId: uuid("person_id").references(() => persons.id).notNull(),
  stageId: uuid("stage_id").references(() => pastoralFrameworkStages.id).notNull(),
  status: text("status").default("in_progress").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  personIdx: index("person_stage_progress_person_id_idx").on(table.personId),
  stageIdx: index("person_stage_progress_stage_id_idx").on(table.stageId),
  personStageUnique: uniqueIndex("person_stage_progress_person_stage_unique").on(table.personId, table.stageId),
}));

export const lineAccounts = pgTable("line_accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id),
  personId: uuid("person_id").references(() => persons.id),
  lineUserId: text("line_user_id").notNull().unique(),
  displayName: text("display_name"),
  pictureUrl: text("picture_url"),
  email: text("email"),
  channelId: text("channel_id"),
  linkedAt: timestamp("linked_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("line_accounts_user_id_idx").on(table.userId),
  personIdx: index("line_accounts_person_id_idx").on(table.personId),
  lineUserIdx: index("line_accounts_line_user_id_idx").on(table.lineUserId),
}));

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
export const insertPersonSchema = createInsertSchema(persons).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPersonIdentityLinkSchema = createInsertSchema(personIdentityLinks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPastoralTaskSchema = createInsertSchema(pastoralTasks).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export const insertServingTeamSchema = createInsertSchema(servingTeams).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServingTeamMemberSchema = createInsertSchema(servingTeamMembers).omit({ id: true, createdAt: true, updatedAt: true, joinedAt: true });
export const insertServingRoleSchema = createInsertSchema(servingRoles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServingScheduleEventSchema = createInsertSchema(servingScheduleEvents).omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true });
export const insertServingAssignmentSchema = createInsertSchema(servingAssignments).omit({ id: true, createdAt: true, updatedAt: true, confirmedAt: true });
export const insertFacilityRoomSchema = createInsertSchema(facilityRooms).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFacilityBookingSchema = createInsertSchema(facilityBookings).omit({ id: true, createdAt: true, updatedAt: true, approvedAt: true });
export const insertPastoralFrameworkStageSchema = createInsertSchema(pastoralFrameworkStages).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPastoralStageRequirementSchema = createInsertSchema(pastoralStageRequirements).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPersonStageProgressSchema = createInsertSchema(personStageProgress).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLineAccountSchema = createInsertSchema(lineAccounts).omit({ id: true, createdAt: true, updatedAt: true, linkedAt: true, lastLoginAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type PastoralTask = typeof pastoralTasks.$inferSelect;
export type InsertPastoralTask = z.infer<typeof insertPastoralTaskSchema>;
export type ServingTeam = typeof servingTeams.$inferSelect;
export type InsertServingTeam = z.infer<typeof insertServingTeamSchema>;
export type ServingTeamMember = typeof servingTeamMembers.$inferSelect;
export type InsertServingTeamMember = z.infer<typeof insertServingTeamMemberSchema>;
export type ServingRole = typeof servingRoles.$inferSelect;
export type InsertServingRole = z.infer<typeof insertServingRoleSchema>;
export type ServingScheduleEvent = typeof servingScheduleEvents.$inferSelect;
export type InsertServingScheduleEvent = z.infer<typeof insertServingScheduleEventSchema>;
export type ServingAssignment = typeof servingAssignments.$inferSelect;
export type InsertServingAssignment = z.infer<typeof insertServingAssignmentSchema>;
export type FacilityRoom = typeof facilityRooms.$inferSelect;
export type InsertFacilityRoom = z.infer<typeof insertFacilityRoomSchema>;
export type FacilityBooking = typeof facilityBookings.$inferSelect;
export type InsertFacilityBooking = z.infer<typeof insertFacilityBookingSchema>;
export type PastoralFrameworkStage = typeof pastoralFrameworkStages.$inferSelect;
export type InsertPastoralFrameworkStage = z.infer<typeof insertPastoralFrameworkStageSchema>;
export type PastoralStageRequirement = typeof pastoralStageRequirements.$inferSelect;
export type InsertPastoralStageRequirement = z.infer<typeof insertPastoralStageRequirementSchema>;
export type PersonStageProgress = typeof personStageProgress.$inferSelect;
export type InsertPersonStageProgress = z.infer<typeof insertPersonStageProgressSchema>;
export type LineAccount = typeof lineAccounts.$inferSelect;
export type InsertLineAccount = z.infer<typeof insertLineAccountSchema>;
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
export type UserEmailPreference = typeof userEmailPreferences.$inferSelect;
export type Person = typeof persons.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type PersonIdentityLink = typeof personIdentityLinks.$inferSelect;
export type InsertPersonIdentityLink = z.infer<typeof insertPersonIdentityLinkSchema>;
export type CareContact = typeof careContacts.$inferSelect;
export type CareAction = typeof careActions.$inferSelect;
export type AiReport = typeof aiReports.$inferSelect;
export type FeatureToggle = typeof featureToggles.$inferSelect;
export type PotentialMember = typeof potentialMembers.$inferSelect;
export type IcebreakerGame = typeof icebreakerGames.$inferSelect;
export type IcebreakerPlayer = typeof icebreakerPlayers.$inferSelect;
export type CardQuestion = typeof cardQuestions.$inferSelect;
export type MessageCard = typeof messageCards.$inferSelect;
export type AppEvent = typeof appEvents.$inferSelect;
export type AppErrorEvent = typeof appErrorEvents.$inferSelect;
export type AiUsageEvent = typeof aiUsageEvents.$inferSelect;

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
export type JourneyTemplate = typeof journeyTemplates.$inferSelect;
export type JourneyDay = typeof journeyDays.$inferSelect;
export type PersonJourney = typeof personJourneys.$inferSelect;
export type JourneyProgress = typeof journeyProgress.$inferSelect;
export type JourneyMilestone = typeof journeyMilestones.$inferSelect;
export type MentorAssignment = typeof mentorAssignments.$inferSelect;

export const inboxEmails = pgTable("inbox_emails", {
  id: serial("id").primaryKey(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  toEmail: text("to_email").notNull(),
  subject: text("subject"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  isRead: boolean("is_read").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  resendEmailId: text("resend_email_id"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});

export type InboxEmail = typeof inboxEmails.$inferSelect;
export type InsertInboxEmail = z.infer<typeof insertInboxEmailSchema>;
export const insertInboxEmailSchema = createInsertSchema(inboxEmails).omit({ id: true, receivedAt: true });

export const insertDevotionalNoteSchema = createInsertSchema(devotionalNotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSavedVerseSchema = createInsertSchema(savedVerses).omit({ id: true, createdAt: true });
export const insertReadingPlanTemplateSchema = createInsertSchema(readingPlanTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserReadingPlanSchema = createInsertSchema(userReadingPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserReadingProgressSchema = createInsertSchema(userReadingProgress).omit({ id: true, createdAt: true });
export const insertJourneyTemplateSchema = createInsertSchema(journeyTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJourneyDaySchema = createInsertSchema(journeyDays).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPersonJourneySchema = createInsertSchema(personJourneys).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJourneyProgressSchema = createInsertSchema(journeyProgress).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJourneyMilestoneSchema = createInsertSchema(journeyMilestones).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMentorAssignmentSchema = createInsertSchema(mentorAssignments).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertDevotionalNote = z.infer<typeof insertDevotionalNoteSchema>;
export type InsertSavedVerse = z.infer<typeof insertSavedVerseSchema>;
export type InsertReadingPlanTemplate = z.infer<typeof insertReadingPlanTemplateSchema>;
export type InsertUserReadingPlan = z.infer<typeof insertUserReadingPlanSchema>;
export type InsertUserReadingProgress = z.infer<typeof insertUserReadingProgressSchema>;
export type InsertJourneyTemplate = z.infer<typeof insertJourneyTemplateSchema>;
export type InsertJourneyDay = z.infer<typeof insertJourneyDaySchema>;
export type InsertPersonJourney = z.infer<typeof insertPersonJourneySchema>;
export type InsertJourneyProgress = z.infer<typeof insertJourneyProgressSchema>;
export type InsertJourneyMilestone = z.infer<typeof insertJourneyMilestoneSchema>;
export type InsertMentorAssignment = z.infer<typeof insertMentorAssignmentSchema>;

export * from "./models/auth";
