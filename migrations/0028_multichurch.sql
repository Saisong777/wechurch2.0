-- Existing data has been explicitly confirmed as iM by Sai. New registrations remain unassigned.
CREATE TABLE church_catalog (id text PRIMARY KEY, display_name text NOT NULL);
INSERT INTO church_catalog(id,display_name) VALUES ('IM 行動教會','iM行動教會'),('桃園WeChurch','桃園WeChurch'),('火樂','火樂');
--> statement-breakpoint
-- Sai approved the cutover snapshot's existing accounts as iM; registrations after this migration remain NULL.
UPDATE users SET church='IM 行動教會';
UPDATE small_groups SET church='IM 行動教會';
UPDATE potential_members SET church='IM 行動教會';
UPDATE persons SET church='IM 行動教會';
--> statement-breakpoint
ALTER TABLE users ADD CONSTRAINT users_church_catalog_fk FOREIGN KEY(church) REFERENCES church_catalog(id);
ALTER TABLE small_groups ADD CONSTRAINT small_groups_church_catalog_fk FOREIGN KEY(church) REFERENCES church_catalog(id);
--> statement-breakpoint
ALTER TABLE prayers ADD COLUMN church text NOT NULL DEFAULT 'IM 行動教會' REFERENCES church_catalog(id);
ALTER TABLE devotion_wall_posts ADD COLUMN church text NOT NULL DEFAULT 'IM 行動教會' REFERENCES church_catalog(id);
ALTER TABLE church_devotions ADD COLUMN church text NOT NULL DEFAULT 'IM 行動教會' REFERENCES church_catalog(id);
ALTER TABLE church_devotion_imports ADD COLUMN church text NOT NULL DEFAULT 'IM 行動教會' REFERENCES church_catalog(id);
ALTER TABLE reading_plan_templates ADD COLUMN church text DEFAULT 'IM 行動教會' REFERENCES church_catalog(id);
ALTER TABLE reading_plan_templates ADD CONSTRAINT reading_plan_public_church_check CHECK (NOT is_public OR church IS NOT NULL);
ALTER TABLE member_feedback ADD COLUMN church text NOT NULL DEFAULT 'IM 行動教會' REFERENCES church_catalog(id);
ALTER TABLE devotion_share_requests ADD COLUMN church text NOT NULL DEFAULT 'IM 行動教會' REFERENCES church_catalog(id);
ALTER TABLE personal_prayer_shares ADD COLUMN church text NOT NULL DEFAULT 'IM 行動教會' REFERENCES church_catalog(id);
ALTER TABLE support_requests ADD COLUMN church text NOT NULL DEFAULT 'IM 行動教會' REFERENCES church_catalog(id);
--> statement-breakpoint
ALTER TABLE church_devotions DROP CONSTRAINT church_devotions_date_unique;
ALTER TABLE church_devotions ADD CONSTRAINT church_devotions_date_unique UNIQUE(church,date) DEFERRABLE INITIALLY IMMEDIATE;
DROP INDEX devotion_wall_source_day_unique;
CREATE UNIQUE INDEX devotion_wall_source_day_unique ON devotion_wall_posts(church,source_note_id,published_day) WHERE withdrawn_at IS NULL;
ALTER TABLE personal_prayer_shares DROP CONSTRAINT personal_prayer_shares_pkey;
ALTER TABLE personal_prayer_shares ADD PRIMARY KEY(prayer_id,destination,church);
--> statement-breakpoint
UPDATE access_grants SET scope='church' WHERE scope='site';
CREATE INDEX prayers_church_created_idx ON prayers(church,created_at DESC);
CREATE INDEX devotion_wall_church_day_idx ON devotion_wall_posts(church,published_day,created_at DESC);
CREATE INDEX feedback_church_created_idx ON member_feedback(church,created_at);
CREATE TABLE church_affiliation_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES users(id),
 user_id uuid NOT NULL REFERENCES users(id), previous_church text, next_church text,
 created_at timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN church text NOT NULL DEFAULT 'IM 行動教會' REFERENCES church_catalog(id);
ALTER TABLE message_cards ADD COLUMN church text NOT NULL DEFAULT 'IM 行動教會' REFERENCES church_catalog(id);
ALTER TABLE card_questions ADD COLUMN church text NOT NULL DEFAULT 'IM 行動教會' REFERENCES church_catalog(id);
ALTER TABLE icebreaker_games ADD COLUMN church text NOT NULL DEFAULT 'IM 行動教會' REFERENCES church_catalog(id);
