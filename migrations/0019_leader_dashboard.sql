CREATE TABLE group_gatherings (
  id uuid PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES small_groups(id),
  gathering_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('group','sunday')),
  cancelled boolean NOT NULL DEFAULT false,
  visitors integer NOT NULL DEFAULT 0 CHECK (visitors >= 0 AND visitors <= 10000),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX group_gatherings_occurrence ON group_gatherings(group_id, gathering_date, kind);
CREATE INDEX group_gatherings_recent ON group_gatherings(group_id, gathering_date DESC);
CREATE TABLE group_gathering_attendance (
  gathering_id uuid NOT NULL REFERENCES group_gatherings(id),
  person_key text NOT NULL,
  name_snapshot text NOT NULL,
  status text NOT NULL DEFAULT 'unrecorded' CHECK (status IN ('present','excused','absent','unrecorded')),
  recorded_by uuid REFERENCES users(id),
  recorded_at timestamptz,
  PRIMARY KEY(gathering_id, person_key)
);
CREATE TABLE group_gathering_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gathering_id uuid NOT NULL REFERENCES group_gatherings(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  changes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX group_gathering_events_history ON group_gathering_events(gathering_id, created_at);
