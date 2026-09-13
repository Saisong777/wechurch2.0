CREATE TYPE "public"."crm_scope_type" AS ENUM('church', 'group', 'member');--> statement-breakpoint
ALTER TYPE "public"."app_role" ADD VALUE 'senior_pastor';--> statement-breakpoint
ALTER TYPE "public"."app_role" ADD VALUE 'pastor';--> statement-breakpoint
ALTER TYPE "public"."app_role" ADD VALUE 'minister';--> statement-breakpoint
ALTER TYPE "public"."app_role" ADD VALUE 'group_leader';--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"feature" text NOT NULL,
	"report_type" text,
	"session_id" uuid,
	"report_id" uuid,
	"group_number" integer,
	"input_chars" integer DEFAULT 0 NOT NULL,
	"output_chars" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"finish_reason" text,
	"quality_score" integer,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"estimated_cost_units" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_error_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'server' NOT NULL,
	"level" text DEFAULT 'error' NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"path" text,
	"method" text,
	"status_code" integer,
	"session_id" uuid,
	"participant_id" uuid,
	"user_id" uuid,
	"metadata" jsonb,
	"user_agent" text,
	"ip_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" text NOT NULL,
	"source" text DEFAULT 'client' NOT NULL,
	"path" text,
	"session_id" uuid,
	"participant_id" uuid,
	"user_id" uuid,
	"user_email" text,
	"metadata" jsonb,
	"user_agent" text,
	"ip_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action_type" text DEFAULT 'note' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relationship" text,
	"need" text DEFAULT '' NOT NULL,
	"next_action" text DEFAULT '' NOT NULL,
	"prayer" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'personal' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"last_cared_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_scope_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignee_user_id" uuid NOT NULL,
	"assigned_by_user_id" uuid,
	"scope_type" "crm_scope_type" NOT NULL,
	"church" text,
	"group_id" uuid,
	"member_user_id" uuid,
	"potential_member_id" uuid,
	"can_view_personal" boolean DEFAULT false NOT NULL,
	"can_manage_care" boolean DEFAULT false NOT NULL,
	"can_manage_members" boolean DEFAULT false NOT NULL,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"church" text,
	"title" text NOT NULL,
	"purpose" text DEFAULT 'small_group' NOT NULL,
	"requester_person_id" uuid,
	"requester_user_id" uuid,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"note" text,
	"created_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church" text,
	"name" text NOT NULL,
	"category" text DEFAULT 'classroom' NOT NULL,
	"location" text,
	"capacity" integer DEFAULT 12 NOT NULL,
	"description" text,
	"priority" integer DEFAULT 50 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"title" text NOT NULL,
	"scripture_reference" text,
	"body_markdown" text,
	"action_prompt" text,
	"reflection_prompt" text,
	"discussion_prompt" text,
	"milestone_key" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_journey_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"milestone_key" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"scheduled_at" timestamp,
	"completed_at" timestamp,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_journey_id" uuid NOT NULL,
	"journey_day_id" uuid NOT NULL,
	"day_number" integer NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"response_text" text,
	"mentor_note" text,
	"needs_follow_up" boolean DEFAULT false NOT NULL,
	"visibility" text DEFAULT 'pastoral' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'discipleship' NOT NULL,
	"duration_days" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "journey_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "line_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"person_id" uuid,
	"line_user_id" text NOT NULL,
	"display_name" text,
	"picture_url" text,
	"email" text,
	"channel_id" text,
	"linked_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "line_accounts_line_user_id_unique" UNIQUE("line_user_id")
);
--> statement-breakpoint
CREATE TABLE "mentor_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"mentor_user_id" uuid,
	"mentor_person_id" uuid,
	"scope" text DEFAULT 'journey' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pastoral_framework_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pastoral_framework_stages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pastoral_stage_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"requirement_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_count" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pastoral_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"due_at" timestamp,
	"assigned_to_user_id" uuid,
	"created_by_user_id" uuid,
	"source_type" text,
	"source_id" text,
	"visibility" text DEFAULT 'pastoral' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_identity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"user_id" uuid,
	"participant_id" uuid,
	"potential_member_id" uuid,
	"care_contact_id" uuid,
	"source_type" text NOT NULL,
	"source_label" text,
	"match_method" text DEFAULT 'manual' NOT NULL,
	"confidence" integer DEFAULT 100 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_journeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"mentor_user_id" uuid,
	"mentor_person_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"next_follow_up_at" timestamp,
	"private_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_merge_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_person_id" uuid NOT NULL,
	"duplicate_person_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"confidence" integer DEFAULT 60 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_stage_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"primary_email" text,
	"church" text,
	"pastoral_stage" text DEFAULT 'unknown' NOT NULL,
	"pastoral_status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serving_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"user_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serving_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"required_count" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serving_schedule_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"title" text NOT NULL,
	"service_date" date NOT NULL,
	"start_time" text,
	"end_time" text,
	"location" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"note" text,
	"created_by_user_id" uuid,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serving_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"user_id" uuid,
	"role_label" text DEFAULT '同工' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "serving_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church" text,
	"name" text NOT NULL,
	"category" text DEFAULT 'service' NOT NULL,
	"description" text,
	"leader_user_id" uuid,
	"default_location" text,
	"default_start_time" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "small_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid,
	"potential_member_id" uuid,
	"member_email" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "small_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"church" text NOT NULL,
	"name" text NOT NULL,
	"leader_user_id" uuid,
	"pastor_user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_email_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"daily_follow_enabled" boolean DEFAULT false NOT NULL,
	"daily_follow_time" text DEFAULT '07:00' NOT NULL,
	"timezone" text DEFAULT 'Asia/Taipei' NOT NULL,
	"last_daily_follow_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "potential_members" ADD COLUMN "church" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "icebreaker_level" text DEFAULT 'L1' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_report_id_ai_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."ai_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_error_events" ADD CONSTRAINT "app_error_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_error_events" ADD CONSTRAINT "app_error_events_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_error_events" ADD CONSTRAINT "app_error_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_events" ADD CONSTRAINT "app_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_events" ADD CONSTRAINT "app_events_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_events" ADD CONSTRAINT "app_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_actions" ADD CONSTRAINT "care_actions_contact_id_care_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."care_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_actions" ADD CONSTRAINT "care_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_contacts" ADD CONSTRAINT "care_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_scope_assignments" ADD CONSTRAINT "crm_scope_assignments_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_scope_assignments" ADD CONSTRAINT "crm_scope_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_scope_assignments" ADD CONSTRAINT "crm_scope_assignments_group_id_small_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."small_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_scope_assignments" ADD CONSTRAINT "crm_scope_assignments_member_user_id_users_id_fk" FOREIGN KEY ("member_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_scope_assignments" ADD CONSTRAINT "crm_scope_assignments_potential_member_id_potential_members_id_fk" FOREIGN KEY ("potential_member_id") REFERENCES "public"."potential_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_room_id_facility_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."facility_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_requester_person_id_persons_id_fk" FOREIGN KEY ("requester_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_days" ADD CONSTRAINT "journey_days_template_id_journey_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."journey_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_milestones" ADD CONSTRAINT "journey_milestones_person_journey_id_person_journeys_id_fk" FOREIGN KEY ("person_journey_id") REFERENCES "public"."person_journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_milestones" ADD CONSTRAINT "journey_milestones_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_progress" ADD CONSTRAINT "journey_progress_person_journey_id_person_journeys_id_fk" FOREIGN KEY ("person_journey_id") REFERENCES "public"."person_journeys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_progress" ADD CONSTRAINT "journey_progress_journey_day_id_journey_days_id_fk" FOREIGN KEY ("journey_day_id") REFERENCES "public"."journey_days"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_templates" ADD CONSTRAINT "journey_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_accounts" ADD CONSTRAINT "line_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_accounts" ADD CONSTRAINT "line_accounts_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_mentor_user_id_users_id_fk" FOREIGN KEY ("mentor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_mentor_person_id_persons_id_fk" FOREIGN KEY ("mentor_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pastoral_stage_requirements" ADD CONSTRAINT "pastoral_stage_requirements_stage_id_pastoral_framework_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pastoral_framework_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pastoral_tasks" ADD CONSTRAINT "pastoral_tasks_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pastoral_tasks" ADD CONSTRAINT "pastoral_tasks_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pastoral_tasks" ADD CONSTRAINT "pastoral_tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_identity_links" ADD CONSTRAINT "person_identity_links_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_identity_links" ADD CONSTRAINT "person_identity_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_identity_links" ADD CONSTRAINT "person_identity_links_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_identity_links" ADD CONSTRAINT "person_identity_links_potential_member_id_potential_members_id_fk" FOREIGN KEY ("potential_member_id") REFERENCES "public"."potential_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_identity_links" ADD CONSTRAINT "person_identity_links_care_contact_id_care_contacts_id_fk" FOREIGN KEY ("care_contact_id") REFERENCES "public"."care_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_journeys" ADD CONSTRAINT "person_journeys_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_journeys" ADD CONSTRAINT "person_journeys_template_id_journey_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."journey_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_journeys" ADD CONSTRAINT "person_journeys_mentor_user_id_users_id_fk" FOREIGN KEY ("mentor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_journeys" ADD CONSTRAINT "person_journeys_mentor_person_id_persons_id_fk" FOREIGN KEY ("mentor_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_merge_suggestions" ADD CONSTRAINT "person_merge_suggestions_primary_person_id_persons_id_fk" FOREIGN KEY ("primary_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_merge_suggestions" ADD CONSTRAINT "person_merge_suggestions_duplicate_person_id_persons_id_fk" FOREIGN KEY ("duplicate_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_stage_progress" ADD CONSTRAINT "person_stage_progress_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_stage_progress" ADD CONSTRAINT "person_stage_progress_stage_id_pastoral_framework_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pastoral_framework_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serving_assignments" ADD CONSTRAINT "serving_assignments_event_id_serving_schedule_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."serving_schedule_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serving_assignments" ADD CONSTRAINT "serving_assignments_role_id_serving_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."serving_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serving_assignments" ADD CONSTRAINT "serving_assignments_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serving_assignments" ADD CONSTRAINT "serving_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serving_roles" ADD CONSTRAINT "serving_roles_team_id_serving_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."serving_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serving_schedule_events" ADD CONSTRAINT "serving_schedule_events_team_id_serving_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."serving_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serving_schedule_events" ADD CONSTRAINT "serving_schedule_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serving_team_members" ADD CONSTRAINT "serving_team_members_team_id_serving_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."serving_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serving_team_members" ADD CONSTRAINT "serving_team_members_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serving_team_members" ADD CONSTRAINT "serving_team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serving_teams" ADD CONSTRAINT "serving_teams_leader_user_id_users_id_fk" FOREIGN KEY ("leader_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "small_group_members" ADD CONSTRAINT "small_group_members_group_id_small_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."small_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "small_group_members" ADD CONSTRAINT "small_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "small_group_members" ADD CONSTRAINT "small_group_members_potential_member_id_potential_members_id_fk" FOREIGN KEY ("potential_member_id") REFERENCES "public"."potential_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "small_groups" ADD CONSTRAINT "small_groups_leader_user_id_users_id_fk" FOREIGN KEY ("leader_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "small_groups" ADD CONSTRAINT "small_groups_pastor_user_id_users_id_fk" FOREIGN KEY ("pastor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_email_preferences" ADD CONSTRAINT "user_email_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_events_feature_idx" ON "ai_usage_events" USING btree ("feature");--> statement-breakpoint
CREATE INDEX "ai_usage_events_created_at_idx" ON "ai_usage_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_events_session_id_idx" ON "ai_usage_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "app_error_events_source_idx" ON "app_error_events" USING btree ("source");--> statement-breakpoint
CREATE INDEX "app_error_events_created_at_idx" ON "app_error_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "app_error_events_status_code_idx" ON "app_error_events" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX "app_events_event_name_idx" ON "app_events" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "app_events_created_at_idx" ON "app_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "app_events_session_id_idx" ON "app_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "care_actions_contact_id_idx" ON "care_actions" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "care_actions_user_id_idx" ON "care_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "care_contacts_user_id_idx" ON "care_contacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "care_contacts_user_active_idx" ON "care_contacts" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "crm_scope_assignments_assignee_user_id_idx" ON "crm_scope_assignments" USING btree ("assignee_user_id");--> statement-breakpoint
CREATE INDEX "crm_scope_assignments_group_id_idx" ON "crm_scope_assignments" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "crm_scope_assignments_church_idx" ON "crm_scope_assignments" USING btree ("church");--> statement-breakpoint
CREATE INDEX "facility_bookings_room_time_idx" ON "facility_bookings" USING btree ("room_id","start_at","end_at");--> statement-breakpoint
CREATE INDEX "facility_bookings_church_idx" ON "facility_bookings" USING btree ("church");--> statement-breakpoint
CREATE INDEX "facility_bookings_status_idx" ON "facility_bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "facility_bookings_requester_person_id_idx" ON "facility_bookings" USING btree ("requester_person_id");--> statement-breakpoint
CREATE INDEX "facility_rooms_church_idx" ON "facility_rooms" USING btree ("church");--> statement-breakpoint
CREATE INDEX "facility_rooms_active_idx" ON "facility_rooms" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_rooms_church_name_unique" ON "facility_rooms" USING btree ("church","name");--> statement-breakpoint
CREATE UNIQUE INDEX "journey_days_template_day_unique" ON "journey_days" USING btree ("template_id","day_number");--> statement-breakpoint
CREATE INDEX "journey_days_template_id_idx" ON "journey_days" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "journey_milestones_person_journey_id_idx" ON "journey_milestones" USING btree ("person_journey_id");--> statement-breakpoint
CREATE INDEX "journey_milestones_person_id_idx" ON "journey_milestones" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "journey_milestones_status_idx" ON "journey_milestones" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "journey_progress_journey_day_unique" ON "journey_progress" USING btree ("person_journey_id","journey_day_id");--> statement-breakpoint
CREATE INDEX "journey_progress_person_journey_id_idx" ON "journey_progress" USING btree ("person_journey_id");--> statement-breakpoint
CREATE INDEX "journey_progress_needs_follow_up_idx" ON "journey_progress" USING btree ("needs_follow_up");--> statement-breakpoint
CREATE INDEX "line_accounts_user_id_idx" ON "line_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "line_accounts_person_id_idx" ON "line_accounts" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "line_accounts_line_user_id_idx" ON "line_accounts" USING btree ("line_user_id");--> statement-breakpoint
CREATE INDEX "mentor_assignments_person_id_idx" ON "mentor_assignments" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "mentor_assignments_mentor_user_id_idx" ON "mentor_assignments" USING btree ("mentor_user_id");--> statement-breakpoint
CREATE INDEX "mentor_assignments_status_idx" ON "mentor_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pastoral_framework_stages_active_idx" ON "pastoral_framework_stages" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "pastoral_framework_stages_sort_order_idx" ON "pastoral_framework_stages" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "pastoral_stage_requirements_stage_id_idx" ON "pastoral_stage_requirements" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "pastoral_stage_requirements_type_idx" ON "pastoral_stage_requirements" USING btree ("requirement_type");--> statement-breakpoint
CREATE UNIQUE INDEX "pastoral_stage_requirements_stage_title_unique" ON "pastoral_stage_requirements" USING btree ("stage_id","title");--> statement-breakpoint
CREATE INDEX "pastoral_tasks_person_id_idx" ON "pastoral_tasks" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "pastoral_tasks_status_idx" ON "pastoral_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pastoral_tasks_assigned_to_user_id_idx" ON "pastoral_tasks" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "pastoral_tasks_due_at_idx" ON "pastoral_tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "person_identity_links_person_id_idx" ON "person_identity_links" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_identity_links_user_id_unique" ON "person_identity_links" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_identity_links_participant_id_unique" ON "person_identity_links" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_identity_links_potential_member_id_unique" ON "person_identity_links" USING btree ("potential_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_identity_links_care_contact_id_unique" ON "person_identity_links" USING btree ("care_contact_id");--> statement-breakpoint
CREATE INDEX "person_identity_links_source_type_idx" ON "person_identity_links" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "person_journeys_person_id_idx" ON "person_journeys" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "person_journeys_template_id_idx" ON "person_journeys" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "person_journeys_status_idx" ON "person_journeys" USING btree ("status");--> statement-breakpoint
CREATE INDEX "person_merge_suggestions_primary_person_id_idx" ON "person_merge_suggestions" USING btree ("primary_person_id");--> statement-breakpoint
CREATE INDEX "person_merge_suggestions_duplicate_person_id_idx" ON "person_merge_suggestions" USING btree ("duplicate_person_id");--> statement-breakpoint
CREATE INDEX "person_merge_suggestions_status_idx" ON "person_merge_suggestions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "person_merge_suggestions_pair_unique" ON "person_merge_suggestions" USING btree ("primary_person_id","duplicate_person_id");--> statement-breakpoint
CREATE INDEX "person_stage_progress_person_id_idx" ON "person_stage_progress" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "person_stage_progress_stage_id_idx" ON "person_stage_progress" USING btree ("stage_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_stage_progress_person_stage_unique" ON "person_stage_progress" USING btree ("person_id","stage_id");--> statement-breakpoint
CREATE UNIQUE INDEX "persons_primary_email_unique" ON "persons" USING btree ("primary_email");--> statement-breakpoint
CREATE INDEX "persons_church_idx" ON "persons" USING btree ("church");--> statement-breakpoint
CREATE INDEX "persons_pastoral_status_idx" ON "persons" USING btree ("pastoral_status");--> statement-breakpoint
CREATE INDEX "serving_assignments_event_id_idx" ON "serving_assignments" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "serving_assignments_role_id_idx" ON "serving_assignments" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "serving_assignments_person_id_idx" ON "serving_assignments" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "serving_assignments_event_role_person_unique" ON "serving_assignments" USING btree ("event_id","role_id","person_id");--> statement-breakpoint
CREATE INDEX "serving_roles_team_id_idx" ON "serving_roles" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "serving_roles_team_name_unique" ON "serving_roles" USING btree ("team_id","name");--> statement-breakpoint
CREATE INDEX "serving_schedule_events_team_date_idx" ON "serving_schedule_events" USING btree ("team_id","service_date");--> statement-breakpoint
CREATE INDEX "serving_schedule_events_status_idx" ON "serving_schedule_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "serving_team_members_team_id_idx" ON "serving_team_members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "serving_team_members_person_id_idx" ON "serving_team_members" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "serving_team_members_user_id_idx" ON "serving_team_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "serving_team_members_team_person_unique" ON "serving_team_members" USING btree ("team_id","person_id");--> statement-breakpoint
CREATE INDEX "serving_teams_church_idx" ON "serving_teams" USING btree ("church");--> statement-breakpoint
CREATE INDEX "serving_teams_leader_user_id_idx" ON "serving_teams" USING btree ("leader_user_id");--> statement-breakpoint
CREATE INDEX "serving_teams_active_idx" ON "serving_teams" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "small_group_members_group_id_idx" ON "small_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "small_group_members_user_id_idx" ON "small_group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "small_group_members_member_email_idx" ON "small_group_members" USING btree ("member_email");--> statement-breakpoint
CREATE INDEX "small_groups_church_idx" ON "small_groups" USING btree ("church");--> statement-breakpoint
INSERT INTO "feature_toggles" ("feature_key", "feature_name", "description", "is_enabled", "disabled_message")
VALUES
	('pastoral_beta', '牧養 beta', '牧養個人頁、愛的旅程與關懷任務', false, '目前只開放給 beta 同工'),
	('serving_beta', '排班 beta', '服事團隊、角色與排班管理', false, '目前只開放給 beta 同工'),
	('facilities_beta', '場地 beta', '教室、聚會與場地預約管理', false, '目前只開放給 beta 同工'),
	('framework_beta', '牧養框架 beta', '牧養階段與成長要求管理', false, '目前只開放給 beta 同工'),
	('line_login_beta', 'LINE beta', 'LINE Login 與內部身份綁定', false, '目前只開放給 beta 同工'),
	('daily_devotion_beta', '每日靈修 beta', '每日靈修與 Morning Brief 整合', false, '目前只開放給 beta 同工')
ON CONFLICT ("feature_key") DO NOTHING;--> statement-breakpoint
CREATE INDEX "small_groups_leader_user_id_idx" ON "small_groups" USING btree ("leader_user_id");
