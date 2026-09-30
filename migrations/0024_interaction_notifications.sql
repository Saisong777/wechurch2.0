CREATE TABLE interaction_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('prayer_amen','prayer_reaction','prayer_comment','family_prayed','family_comment')),
  prayer_id uuid REFERENCES prayers(id) ON DELETE CASCADE,
  share_id uuid REFERENCES life_group_shares(id) ON DELETE CASCADE,
  prayer_comment_id uuid REFERENCES prayer_comments(id) ON DELETE CASCADE,
  family_comment_id uuid REFERENCES life_group_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  email_claimed_at timestamptz,
  CHECK (user_id <> actor_id),
  CHECK ((prayer_id IS NOT NULL)::int + (share_id IS NOT NULL)::int = 1),
  UNIQUE (user_id,event_key)
);
--> statement-breakpoint
CREATE INDEX interaction_notifications_feed ON interaction_notifications(user_id,created_at DESC,id DESC);
--> statement-breakpoint
CREATE INDEX interaction_notifications_unread ON interaction_notifications(user_id,created_at DESC) WHERE read_at IS NULL;
--> statement-breakpoint
CREATE INDEX interaction_notifications_email ON interaction_notifications(user_id,created_at) WHERE read_at IS NULL AND email_claimed_at IS NULL;
--> statement-breakpoint
ALTER TABLE user_email_preferences ADD COLUMN interaction_email_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN interaction_email_consent_at timestamptz;
--> statement-breakpoint
CREATE TABLE interaction_email_deliveries (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_hour timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('claimed','accepted','unconfirmed','skipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,batch_hour)
);
