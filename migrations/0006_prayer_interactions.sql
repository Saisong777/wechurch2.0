ALTER TABLE prayers ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE prayer_comments ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'encouragement';
ALTER TABLE prayer_comments ADD COLUMN IF NOT EXISTS sticker text;
ALTER TABLE prayer_comments ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS prayer_comment_request_unique ON prayer_comments(user_id,request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prayer_comments_prayer_idx ON prayer_comments(prayer_id,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS prayer_reactions (
  prayer_id uuid NOT NULL REFERENCES prayers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('heart','support','strength')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(prayer_id,user_id,kind)
);
