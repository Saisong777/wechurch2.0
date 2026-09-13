ALTER TABLE prayers ADD COLUMN IF NOT EXISTS closed_at timestamptz;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS devotion_wall_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_note_id uuid REFERENCES devotional_notes(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  published_day date NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  reference text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  withdrawn_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS devotion_wall_source_day_unique ON devotion_wall_posts(source_note_id,published_day) WHERE withdrawn_at IS NULL;
CREATE INDEX IF NOT EXISTS devotion_wall_active_idx ON devotion_wall_posts(published_day,expires_at) WHERE withdrawn_at IS NULL;
