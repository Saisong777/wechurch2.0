CREATE TABLE life_group_invites (
  group_id uuid PRIMARY KEY REFERENCES small_groups(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id)
);
--> statement-breakpoint
CREATE TABLE life_group_requests (
  group_id uuid NOT NULL REFERENCES small_groups(id),
  user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(group_id,user_id)
);
--> statement-breakpoint
CREATE TABLE life_group_reading (
  group_id uuid NOT NULL REFERENCES small_groups(id),
  user_id uuid NOT NULL REFERENCES users(id),
  devotion_id uuid NOT NULL REFERENCES church_devotions(id),
  devotion_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(group_id,user_id,devotion_id)
);
--> statement-breakpoint
CREATE TABLE life_group_shares (
  id uuid PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES small_groups(id),
  author_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL CHECK (kind IN ('note','prayer')),
  title text NOT NULL, body text NOT NULL, reference text NOT NULL DEFAULT '',
  source_id uuid,
  answered boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);
CREATE INDEX life_group_shares_feed ON life_group_shares(group_id,kind,created_at DESC,id DESC);
--> statement-breakpoint
CREATE TABLE life_group_comments (
  id uuid PRIMARY KEY,
  share_id uuid NOT NULL REFERENCES life_group_shares(id),
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);
CREATE INDEX life_group_comments_share ON life_group_comments(share_id,created_at);
--> statement-breakpoint
CREATE TABLE life_group_prayed (
  share_id uuid NOT NULL REFERENCES life_group_shares(id),
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(share_id,user_id)
);
--> statement-breakpoint
CREATE TABLE life_group_care (
  id uuid PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES small_groups(id),
  creator_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL, need text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','following','paused','completed')),
  responsible_id uuid REFERENCES users(id),
  next_action text NOT NULL DEFAULT '', due_date date,
  consent_confirmed_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);
CREATE INDEX life_group_care_group ON life_group_care(group_id,updated_at DESC);
--> statement-breakpoint
CREATE TABLE life_group_care_updates (
  id uuid PRIMARY KEY,
  care_id uuid NOT NULL REFERENCES life_group_care(id),
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL, status text NOT NULL,
  next_action text NOT NULL, due_date date, responsible_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX life_group_care_updates_case ON life_group_care_updates(care_id,created_at DESC);
--> statement-breakpoint
CREATE TABLE life_group_care_watches (
  care_id uuid NOT NULL REFERENCES life_group_care(id),
  user_id uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY(care_id,user_id)
);
