CREATE TABLE support_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  church text NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE support_requests (
  id uuid PRIMARY KEY,
  sender_id uuid NOT NULL REFERENCES users(id),
  receiver_id uuid NOT NULL REFERENCES users(id),
  group_id uuid REFERENCES small_groups(id),
  destination_id uuid REFERENCES support_destinations(id),
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','waiting_requester','waiting_support','completed','declined','cancelled')),
  next_action text NOT NULL DEFAULT '',
  due_date date,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  consent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((group_id IS NULL) <> (destination_id IS NULL)),
  CHECK (sender_id <> receiver_id)
);
--> statement-breakpoint
CREATE INDEX support_requests_sender_idx ON support_requests(sender_id, updated_at DESC);
CREATE INDEX support_requests_receiver_idx ON support_requests(receiver_id, status, updated_at DESC);
--> statement-breakpoint
CREATE TABLE support_events (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES support_requests(id),
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  is_private boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX support_events_request_idx ON support_events(request_id, created_at);
--> statement-breakpoint
CREATE TABLE support_destination_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES support_destinations(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE journey_progress ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE journey_progress ADD COLUMN content_snapshot jsonb;
ALTER TABLE journey_progress ALTER COLUMN visibility SET DEFAULT 'private';
UPDATE journey_progress SET visibility='private';
UPDATE journey_progress jp SET content_snapshot=to_jsonb(jd) FROM journey_days jd WHERE jd.id=jp.journey_day_id;
