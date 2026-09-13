CREATE TABLE "participant_access" (
  "participant_id" uuid PRIMARY KEY REFERENCES "participants"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id"),
  "browser_hash" text NOT NULL,
  "recovered_by" uuid REFERENCES "users"("id"),
  "recovery_reason" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "participant_access_user_idx" ON "participant_access" ("user_id");
--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "merged_into_person_id" uuid REFERENCES "persons"("id");
--> statement-breakpoint
CREATE TABLE "person_merge_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "primary_person_id" uuid NOT NULL REFERENCES "persons"("id"),
  "duplicate_person_id" uuid NOT NULL REFERENCES "persons"("id"),
  "actor_user_id" uuid REFERENCES "users"("id"),
  "snapshot" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CHECK (primary_person_id <> duplicate_person_id)
);
--> statement-breakpoint
-- Late writes with an old person ID follow the canonical record after a merge.
CREATE FUNCTION canonical_person_reference() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_id uuid; target_id uuid;
BEGIN
  source_id := (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
  IF source_id IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(merged_into_person_id,id) INTO target_id FROM persons WHERE id=source_id FOR KEY SHARE;
  IF target_id IS NOT NULL AND target_id <> source_id THEN
    NEW := jsonb_populate_record(NEW,jsonb_build_object(TG_ARGV[0],target_id));
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DO $$ DECLARE ref record;
BEGIN
  FOR ref IN SELECT * FROM (VALUES
    ('facility_bookings','requester_person_id'),('journey_milestones','person_id'),
    ('line_accounts','person_id'),('mentor_assignments','person_id'),('mentor_assignments','mentor_person_id'),
    ('pastoral_tasks','person_id'),('person_identity_links','person_id'),('person_journeys','person_id'),
    ('person_journeys','mentor_person_id'),('person_stage_progress','person_id'),
    ('serving_assignments','person_id'),('serving_team_members','person_id')
  ) AS refs(table_name,column_name)
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I ON %I FOR EACH ROW EXECUTE FUNCTION canonical_person_reference(%L)',
      'canonical_' || ref.column_name,ref.column_name,ref.table_name,ref.column_name);
  END LOOP;
END $$;
