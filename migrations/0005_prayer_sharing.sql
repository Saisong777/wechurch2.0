ALTER TABLE life_group_shares ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE personal_prayer_shares (
  prayer_id uuid NOT NULL REFERENCES personal_prayers(id),
  destination text NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id),
  group_id uuid REFERENCES small_groups(id),
  post_id uuid NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prayer_id, destination),
  CHECK ((group_id IS NULL AND destination = 'public') OR (group_id IS NOT NULL AND destination = group_id::text))
);
--> statement-breakpoint
CREATE INDEX personal_prayer_shares_owner_idx ON personal_prayer_shares(owner_id);
