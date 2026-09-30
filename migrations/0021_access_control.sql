CREATE TABLE access_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church text NOT NULL,
  name text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(permissions)='array'),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(church,name)
);
--> statement-breakpoint
CREATE TABLE access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  role_id uuid NOT NULL REFERENCES access_roles(id),
  church text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('church','group','member','site')),
  group_id uuid REFERENCES small_groups(id),
  member_id uuid REFERENCES users(id),
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(permissions)='array'),
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope='group')=(group_id IS NOT NULL)),
  CHECK ((scope='member')=(member_id IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX access_grants_user_idx ON access_grants(user_id) WHERE active;
--> statement-breakpoint
CREATE TABLE access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church text NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  target_id uuid,
  action text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX access_audit_church_idx ON access_audit(church,created_at DESC);
--> statement-breakpoint
INSERT INTO access_roles(church,name) SELECT 'IM 行動教會',name FROM unnest(ARRAY['主任牧師','牧者','同工','小家長','長老','執事','會友']) AS name;
