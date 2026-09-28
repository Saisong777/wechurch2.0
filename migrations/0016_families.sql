ALTER TABLE small_groups ADD COLUMN description text NOT NULL DEFAULT '',
 ADD COLUMN meeting text NOT NULL DEFAULT '', ADD COLUMN announcement text NOT NULL DEFAULT '',
 ADD COLUMN is_listed boolean NOT NULL DEFAULT false,
 ADD COLUMN lifecycle text NOT NULL DEFAULT 'active' CHECK(lifecycle IN ('active','paused','archived')),
 ADD COLUMN version integer NOT NULL DEFAULT 1;
UPDATE small_groups SET lifecycle='archived' WHERE NOT is_active;
ALTER TABLE small_group_members ADD COLUMN history_from timestamptz NOT NULL DEFAULT 'epoch';
ALTER TABLE small_group_members ALTER COLUMN history_from SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE life_group_invites ADD COLUMN short_code_hash text UNIQUE;
ALTER TABLE life_group_shares DROP CONSTRAINT life_group_shares_kind_check;
ALTER TABLE life_group_shares ADD CONSTRAINT life_group_shares_kind_check CHECK(kind IN ('note','prayer','message'));
CREATE INDEX life_group_shares_all_feed ON life_group_shares(group_id,created_at DESC,id DESC) WHERE withdrawn_at IS NULL;
--> statement-breakpoint
CREATE TABLE family_matching_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 church text NOT NULL, availability text NOT NULL, region text NOT NULL DEFAULT '', contact text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','contacting','matched','cancelled')),
 owner_id uuid REFERENCES users(id), group_id uuid REFERENCES small_groups(id),
 message text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX family_matching_one_open ON family_matching_requests(user_id) WHERE status IN ('pending','contacting');
CREATE INDEX family_matching_queue ON family_matching_requests(church,status,created_at);
--> statement-breakpoint
CREATE TABLE family_membership_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES small_groups(id),
 user_id uuid REFERENCES users(id), actor_id uuid NOT NULL REFERENCES users(id),
 action text NOT NULL, target_group_id uuid REFERENCES small_groups(id), reason text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX family_membership_events_group ON family_membership_events(group_id,created_at DESC);
