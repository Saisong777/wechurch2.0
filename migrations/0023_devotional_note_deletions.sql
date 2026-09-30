-- Content-free tombstones prevent stale clients and source imports restoring deleted notes.
CREATE TABLE devotional_note_deletions (
  note_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_key text UNIQUE,
  record_sha256 text,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
