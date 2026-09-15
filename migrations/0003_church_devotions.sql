CREATE TABLE church_devotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  plan_name text NOT NULL,
  day_number integer NOT NULL CHECK (day_number > 0),
  scripture_reference text NOT NULL,
  scripture_text text NOT NULL DEFAULT '',
  devotional_title text NOT NULL,
  devotional_text text NOT NULL,
  prayer text NOT NULL DEFAULT '',
  love_action text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  version integer NOT NULL DEFAULT 1,
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT church_devotions_date_unique UNIQUE(date) DEFERRABLE INITIALLY IMMEDIATE
);
--> statement-breakpoint
CREATE TABLE church_devotion_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  preview jsonb NOT NULL,
  result jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE church_devotion_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devotion_id uuid NOT NULL REFERENCES church_devotions(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX church_devotion_history_entry_idx ON church_devotion_history(devotion_id, created_at);
