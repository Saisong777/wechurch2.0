ALTER TABLE care_contacts ADD COLUMN next_care_date date;
--> statement-breakpoint
CREATE INDEX care_actions_history_idx ON care_actions(contact_id, created_at DESC, id DESC);
--> statement-breakpoint
CREATE TABLE care_visit_requests (
  id uuid PRIMARY KEY,
  sender_id uuid NOT NULL REFERENCES users(id),
  contact_id uuid REFERENCES care_contacts(id),
  church text NOT NULL,
  name text NOT NULL,
  reason text NOT NULL,
  contact_method text NOT NULL,
  urgency text NOT NULL CHECK (urgency IN ('normal','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','completed','cancelled')),
  assignee_id uuid REFERENCES users(id),
  due_date date,
  next_action text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  consent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX care_visit_sender_idx ON care_visit_requests(sender_id, created_at DESC);
CREATE INDEX care_visit_inbox_idx ON care_visit_requests(church, status, urgency, created_at);
--> statement-breakpoint
CREATE TABLE care_visit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES care_visit_requests(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_visit_events_request_idx ON care_visit_events(request_id, created_at DESC);
