ALTER TABLE user_email_preferences ADD COLUMN daily_follow_consent_at timestamp;
--> statement-breakpoint
CREATE TABLE email_reminder_deliveries (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  local_day date NOT NULL,
  status text NOT NULL CHECK (status IN ('claimed', 'accepted', 'unconfirmed')),
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, local_day)
);
--> statement-breakpoint
CREATE INDEX email_reminder_deliveries_status_idx ON email_reminder_deliveries(status, created_at);
