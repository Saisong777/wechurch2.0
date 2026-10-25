CREATE TABLE castle_avatar_profiles (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 profile jsonb NOT NULL CONSTRAINT castle_avatar_profile_object CHECK(jsonb_typeof(profile)='object'),
 revision integer NOT NULL DEFAULT 1 CONSTRAINT castle_avatar_profile_revision CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
