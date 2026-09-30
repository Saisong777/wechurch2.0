ALTER TABLE person_journeys ADD COLUMN owner_user_id uuid REFERENCES users(id);
UPDATE person_journeys j SET owner_user_id=owners.user_id FROM (
  SELECT person_id,(array_agg(DISTINCT user_id))[1] AS user_id FROM person_identity_links
  WHERE user_id IS NOT NULL GROUP BY person_id HAVING count(DISTINCT user_id)=1
) owners WHERE owners.person_id=j.person_id;
--> statement-breakpoint
CREATE TABLE mentoring_contracts (
  id uuid PRIMARY KEY,
  journey_id uuid NOT NULL REFERENCES person_journeys(id),
  learner_id uuid NOT NULL REFERENCES users(id),
  mentor_id uuid NOT NULL REFERENCES users(id),
  group_id uuid NOT NULL REFERENCES small_groups(id),
  course_name text NOT NULL,
  cadence_days integer NOT NULL CHECK (cadence_days IN (7,14,30)),
  agreement text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','declined','ended')),
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  learner_consented_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (learner_id<>mentor_id),
  UNIQUE(id,journey_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX mentoring_one_current_journey ON mentoring_contracts(journey_id) WHERE status IN ('pending','active');
CREATE INDEX mentoring_learner_idx ON mentoring_contracts(learner_id,created_at DESC);
CREATE INDEX mentoring_mentor_idx ON mentoring_contracts(mentor_id,status,created_at DESC);
--> statement-breakpoint
CREATE TABLE mentoring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES mentoring_contracts(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mentoring_feedback (
  id uuid PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES mentoring_contracts(id),
  author_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL CHECK (kind IN ('reflection','practice','feedback')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mentoring_feedback_contract_idx ON mentoring_feedback(contract_id,created_at);
--> statement-breakpoint
ALTER TABLE journey_progress ADD COLUMN mentor_contract_id uuid;
ALTER TABLE journey_progress ADD CONSTRAINT journey_progress_mentor_journey_fk FOREIGN KEY(mentor_contract_id,person_journey_id) REFERENCES mentoring_contracts(id,journey_id);
ALTER TABLE journey_progress ADD CONSTRAINT journey_progress_mentor_binding CHECK ((visibility='mentor')=(mentor_contract_id IS NOT NULL));
