ALTER TABLE devotional_notes ADD COLUMN source_devotional_date date;
ALTER TABLE devotional_notes ADD COLUMN source_label text;

CREATE TABLE im_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_sha256 text NOT NULL CHECK (bundle_sha256 ~ '^[a-f0-9]{64}$'),
  source_exported_at timestamptz NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  rolled_back_at timestamptz
);
CREATE UNIQUE INDEX im_import_active_bundle ON im_import_batches(bundle_sha256) WHERE rolled_back_at IS NULL;

CREATE TABLE im_source_accounts (
  project_id text NOT NULL CHECK (project_id = 'imbibleapp-5c371'),
  source_uid text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  google_subject text NOT NULL REFERENCES google_account_links(google_subject),
  plan_id uuid NOT NULL UNIQUE REFERENCES user_reading_plans(id),
  PRIMARY KEY (project_id, source_uid),
  UNIQUE (project_id, user_id),
  UNIQUE (project_id, source_uid, user_id)
);

CREATE TABLE im_source_records (
  source_key text PRIMARY KEY CHECK (source_key ~ '^[a-f0-9]{64}$'),
  project_id text NOT NULL,
  source_uid text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  batch_id uuid NOT NULL REFERENCES im_import_batches(id),
  kind text NOT NULL CHECK (kind IN ('note','read-day')),
  record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
  original_record jsonb NOT NULL,
  note_id uuid UNIQUE REFERENCES devotional_notes(id),
  progress_id uuid UNIQUE REFERENCES user_reading_progress(id),
  target_sha256 text NOT NULL,
  FOREIGN KEY (project_id, source_uid, user_id) REFERENCES im_source_accounts(project_id, source_uid, user_id),
  CHECK ((kind='note' AND note_id IS NOT NULL AND progress_id IS NULL) OR
         (kind='read-day' AND progress_id IS NOT NULL AND note_id IS NULL))
);
CREATE INDEX im_source_records_owner ON im_source_records(user_id,kind);
