CREATE TYPE "public"."app_role" AS ENUM('member', 'leader', 'future_leader', 'admin');--> statement-breakpoint
CREATE TYPE "public"."card_level" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."game_mode" AS ENUM('free', 'turn');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."grouping_method" AS ENUM('random', 'gender-balanced');--> statement-breakpoint
CREATE TYPE "public"."insight_category_type" AS ENUM('PROMISE', 'COMMAND', 'WARNING', 'GOD_ATTRIBUTE');--> statement-breakpoint
CREATE TYPE "public"."prayer_category" AS ENUM('thanksgiving', 'supplication', 'praise', 'other');--> statement-breakpoint
CREATE TYPE "public"."prayer_meeting_gender_mode" AS ENUM('mixed', 'separate', 'male_only', 'female_only');--> statement-breakpoint
CREATE TYPE "public"."prayer_meeting_status" AS ENUM('joining', 'grouped', 'praying', 'completed');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('PENDING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('group', 'overall');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('waiting', 'grouping', 'studying', 'verification', 'completed');--> statement-breakpoint
CREATE TYPE "public"."user_gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TABLE "ai_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"report_type" text NOT NULL,
	"group_number" integer,
	"content" text NOT NULL,
	"status" text DEFAULT 'COMPLETED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blessing_verses" (
	"id" serial PRIMARY KEY NOT NULL,
	"verse_id" integer NOT NULL,
	"book_name" text NOT NULL,
	"book_number" integer,
	"chapter" integer NOT NULL,
	"verse" integer NOT NULL,
	"text" text NOT NULL,
	"blessing_verse" text,
	"blessing_type" text,
	"ai_pastoral_safety" text,
	"text_norm" text,
	"uplift_score" integer,
	"emotional_focus" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "card_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_text" text NOT NULL,
	"content_text_en" text,
	"level" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chinese_union_trad" (
	"verse_id" integer PRIMARY KEY NOT NULL,
	"book_name" text NOT NULL,
	"book_number" integer,
	"chapter" integer NOT NULL,
	"verse" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devotional_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"verse_reference" text NOT NULL,
	"verse_text" text NOT NULL,
	"theme" text,
	"key_verse" text,
	"new_understanding" text,
	"promises" text,
	"notes" text,
	"title_phrase" text,
	"heartbeat_verse" text,
	"observation" text,
	"core_insight_category" text,
	"core_insight_note" text,
	"scholars_note" text,
	"action_plan" text,
	"cool_down_note" text,
	"reading_plan_id" uuid,
	"day_number" integer,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_toggles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_key" text NOT NULL,
	"feature_name" text NOT NULL,
	"description" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"disabled_message" text DEFAULT '即將推出',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "feature_toggles_feature_key_unique" UNIQUE("feature_key")
);
--> statement-breakpoint
CREATE TABLE "grouping_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"short_code" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'joining' NOT NULL,
	"grouping_mode" text DEFAULT 'bySize' NOT NULL,
	"group_size" integer DEFAULT 4,
	"group_count" integer DEFAULT 3,
	"gender_mode" text DEFAULT 'mixed' NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "grouping_activities_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "grouping_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"gender" text NOT NULL,
	"group_number" integer,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icebreaker_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_code" text NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"mode" text DEFAULT 'free' NOT NULL,
	"current_level" text,
	"current_card_id" text,
	"used_card_ids" text[],
	"pass_count" integer DEFAULT 0,
	"bible_study_session_id" uuid,
	"group_number" integer,
	"timer_duration" integer DEFAULT 60,
	"timer_started_at" timestamp,
	"timer_running" boolean DEFAULT false,
	"sharing_mode" boolean DEFAULT false NOT NULL,
	"shared_member_ids" text[],
	"current_drawer_id" text,
	"current_drawer_card_id" text,
	"drawer_order" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "icebreaker_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"participant_id" uuid,
	"display_name" text NOT NULL,
	"gender" text,
	"is_active" boolean DEFAULT true,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inbox_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text,
	"to_email" text NOT NULL,
	"subject" text,
	"body_text" text,
	"body_html" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"resend_email_id" text,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jesus_4seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"event_id" text,
	"date_maybe" text,
	"date_stage" text,
	"stage_short" text,
	"season" text NOT NULL,
	"approximate_date" text,
	"location" text,
	"event_name" text NOT NULL,
	"event_category" text,
	"theological_theme" text,
	"jesus_character" text,
	"focus" text,
	"gospel_center" text,
	"scripture_overview" text,
	"scripture_mt" text,
	"scripture_mk" text,
	"scripture_lk" text,
	"scripture_jn" text,
	"scripture_status" text,
	"harmony_principle" text,
	"date_confidence" text,
	"order_confidence" text,
	"data_type" text,
	"category_five_main" text,
	"category_research_basis" text,
	"teaching_theme_research" text,
	"category_research_detail" text,
	"teaching_kingdom_secondary" text,
	"parable_secondary" text,
	"miracle_secondary" text,
	"category_research_final" text,
	"demonstration_secondary" text,
	"wisdom_secondary" text,
	"humor_secondary" text,
	"category_research_ultimate" text,
	"category_tags" text,
	"nt_cross_reference" text,
	"nt_cross_reference_reason" text,
	"nt_cross_reference_event" text,
	"nt_cross_reference_conclusion" text,
	"theme_index_research" text,
	"ot_messiah_cross_ref" text,
	"ot_scripture_quote_jesus" text,
	"typology_people" text,
	"ot_scripture_quote_jesus_expanded" text,
	"typology_primary_level" text,
	"typology_secondary_level" text,
	"gospel_center_micro_narrative" text,
	"gospel_center_old" text,
	"user_pain_point_tags" text,
	"takeaway_phrase" text,
	"user_pain_point_primary" text,
	"user_pain_point_secondary" text
);
--> statement-breakpoint
CREATE TABLE "jesus_daily_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" integer NOT NULL,
	"event_id" text NOT NULL,
	"event_name" text NOT NULL,
	"location" text,
	"scripture_overview" text,
	"ai_description" text NOT NULL,
	"image_url" text,
	"date_maybe" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jesus_daily_content_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "message_card_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"user_id" uuid,
	"user_name" text NOT NULL,
	"user_email" text NOT NULL,
	"downloaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"short_code" text NOT NULL,
	"image_path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "message_cards_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"gender" text NOT NULL,
	"group_number" integer,
	"location" text DEFAULT 'On-site' NOT NULL,
	"ready_confirmed" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "potential_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"gender" text,
	"user_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"subscribed" boolean DEFAULT true NOT NULL,
	"first_joined_at" timestamp DEFAULT now() NOT NULL,
	"last_session_at" timestamp DEFAULT now() NOT NULL,
	"sessions_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "potential_members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "prayer_amens" (
	"prayer_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prayer_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prayer_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prayer_meeting_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"gender" text NOT NULL,
	"group_number" integer,
	"prayer_request" text,
	"urgent_prayer" text,
	"anonymous_prayer" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"prayer_category" text,
	"is_urgent" boolean DEFAULT false,
	"anonymous_prayer_category" text,
	"is_anonymous_prayer_urgent" boolean DEFAULT false,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prayer_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"short_code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'joining' NOT NULL,
	"grouping_mode" text DEFAULT 'bySize' NOT NULL,
	"group_size" integer DEFAULT 4,
	"group_count" integer DEFAULT 3,
	"gender_mode" text DEFAULT 'mixed' NOT NULL,
	"separate_by_gender" boolean DEFAULT false,
	"owner_id" uuid,
	"prayer_report" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prayer_meetings_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "prayer_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prayer_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_name" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prayers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_answered" boolean DEFAULT false NOT NULL,
	"answered_at" timestamp,
	"scripture_reference" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_plan_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"title" text,
	"book_name" text,
	"chapter_start" integer,
	"chapter_end" integer,
	"verse_start" integer,
	"verse_end" integer,
	"scripture_reference" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "reading_plan_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'custom' NOT NULL,
	"duration_days" integer DEFAULT 365 NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_verses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"verse_reference" text NOT NULL,
	"verse_text" text NOT NULL,
	"book_name" text NOT NULL,
	"chapter" integer NOT NULL,
	"verse_start" integer NOT NULL,
	"verse_end" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church_unit" text,
	"verse_reference" text NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"group_size" integer DEFAULT 4,
	"grouping_method" text DEFAULT 'random',
	"owner_id" uuid,
	"short_code" text,
	"allow_latecomers" boolean DEFAULT false NOT NULL,
	"icebreaker_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "study_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title_phrase" text,
	"heartbeat_verse" text,
	"observation" text,
	"core_insight_category" text,
	"core_insight_note" text,
	"scholars_note" text,
	"action_plan" text,
	"cool_down_note" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"group_number" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"bible_verse" text NOT NULL,
	"theme" text DEFAULT '',
	"moving_verse" text DEFAULT '',
	"facts_discovered" text DEFAULT '',
	"traditional_exegesis" text DEFAULT '',
	"inspiration_from_god" text DEFAULT '',
	"application_in_life" text DEFAULT '',
	"others" text DEFAULT '',
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_reading_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"reminder_enabled" boolean DEFAULT true,
	"reminder_morning" text DEFAULT '07:00',
	"reminder_noon" text DEFAULT '12:00',
	"reminder_evening" text DEFAULT '20:00',
	"total_days" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_reading_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"reading_date" date NOT NULL,
	"scripture_reference" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"devotional_note_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "app_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"birthday" date,
	"user_gender" "user_gender",
	"address" text,
	"church" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devotional_notes" ADD CONSTRAINT "devotional_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devotional_notes" ADD CONSTRAINT "devotional_notes_reading_plan_id_user_reading_plans_id_fk" FOREIGN KEY ("reading_plan_id") REFERENCES "public"."user_reading_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_toggles" ADD CONSTRAINT "feature_toggles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grouping_activities" ADD CONSTRAINT "grouping_activities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grouping_participants" ADD CONSTRAINT "grouping_participants_activity_id_grouping_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."grouping_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_games" ADD CONSTRAINT "icebreaker_games_bible_study_session_id_sessions_id_fk" FOREIGN KEY ("bible_study_session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_players" ADD CONSTRAINT "icebreaker_players_game_id_icebreaker_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."icebreaker_games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_players" ADD CONSTRAINT "icebreaker_players_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_card_downloads" ADD CONSTRAINT "message_card_downloads_card_id_message_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."message_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_card_downloads" ADD CONSTRAINT "message_card_downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_cards" ADD CONSTRAINT "message_cards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "potential_members" ADD CONSTRAINT "potential_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_amens" ADD CONSTRAINT "prayer_amens_prayer_id_prayers_id_fk" FOREIGN KEY ("prayer_id") REFERENCES "public"."prayers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_amens" ADD CONSTRAINT "prayer_amens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_comments" ADD CONSTRAINT "prayer_comments_prayer_id_prayers_id_fk" FOREIGN KEY ("prayer_id") REFERENCES "public"."prayers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_comments" ADD CONSTRAINT "prayer_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_meeting_participants" ADD CONSTRAINT "prayer_meeting_participants_meeting_id_prayer_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."prayer_meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_meeting_participants" ADD CONSTRAINT "prayer_meeting_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_meetings" ADD CONSTRAINT "prayer_meetings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_notifications" ADD CONSTRAINT "prayer_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_notifications" ADD CONSTRAINT "prayer_notifications_prayer_id_prayers_id_fk" FOREIGN KEY ("prayer_id") REFERENCES "public"."prayers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayers" ADD CONSTRAINT "prayers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_plan_template_items" ADD CONSTRAINT "reading_plan_template_items_template_id_reading_plan_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."reading_plan_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_plan_templates" ADD CONSTRAINT "reading_plan_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_verses" ADD CONSTRAINT "saved_verses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_responses" ADD CONSTRAINT "study_responses_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reading_plans" ADD CONSTRAINT "user_reading_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reading_plans" ADD CONSTRAINT "user_reading_plans_template_id_reading_plan_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."reading_plan_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reading_progress" ADD CONSTRAINT "user_reading_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reading_progress" ADD CONSTRAINT "user_reading_progress_plan_id_user_reading_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."user_reading_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reading_progress" ADD CONSTRAINT "user_reading_progress_devotional_note_id_devotional_notes_id_fk" FOREIGN KEY ("devotional_note_id") REFERENCES "public"."devotional_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "study_responses_session_user_unique" ON "study_responses" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "study_responses_session_id_idx" ON "study_responses" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "IDX_auth_session_expire" ON "auth_sessions" USING btree ("expire");