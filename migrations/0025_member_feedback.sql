CREATE TABLE member_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  request_id uuid NOT NULL,
  category text NOT NULL CHECK(category IN ('bug','suggestion','question','other')),
  title text NOT NULL CHECK(length(title) BETWEEN 3 AND 120),
  body text NOT NULL CHECK(length(body) BETWEEN 10 AND 5000),
  location text NOT NULL DEFAULT '/' CHECK(length(location)<=200),
  urgency text NOT NULL DEFAULT 'normal' CHECK(urgency IN ('normal','blocked','security')),
  consent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','planned','done')),
  priority text NOT NULL DEFAULT 'P2' CHECK(priority IN ('P0','P1','P2','P3')),
  public_reply text NOT NULL DEFAULT '' CHECK(length(public_reply)<=3000),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  source_version integer NOT NULL DEFAULT 1 CHECK(source_version>0),
  content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
  analysis_status text NOT NULL DEFAULT 'pending' CHECK(analysis_status IN ('pending','running','ready','failed')),
  analysis jsonb, analysis_error text, analysis_model text, analyzed_at timestamptz,
  lease_token uuid, lease_until timestamptz,
  analysis_attempts integer NOT NULL DEFAULT 0 CHECK(analysis_attempts>=0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,request_id),
  CHECK((analysis_status='running' AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR (analysis_status<>'running' AND lease_token IS NULL AND lease_until IS NULL))
);
--> statement-breakpoint
CREATE INDEX member_feedback_owner ON member_feedback(user_id,created_at DESC,id DESC);
--> statement-breakpoint
CREATE INDEX member_feedback_queue ON member_feedback(status,priority,created_at,id);
--> statement-breakpoint
CREATE INDEX member_feedback_analysis_queue ON member_feedback(analysis_status,lease_until,created_at) WHERE analysis_status IN ('pending','running','failed');
--> statement-breakpoint
CREATE TABLE member_feedback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES member_feedback(id),
  actor_id uuid REFERENCES users(id),
  action text NOT NULL CHECK(action IN ('created','updated','reanalyze','analysis_ready','analysis_failed')),
  before_data jsonb, after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX member_feedback_events_history ON member_feedback_events(feedback_id,created_at DESC,id DESC);
