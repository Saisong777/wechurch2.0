ALTER TABLE small_groups ADD COLUMN co_leader_user_id uuid REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE small_groups ADD CONSTRAINT small_groups_distinct_leaders CHECK(co_leader_user_id IS NULL OR co_leader_user_id IS DISTINCT FROM leader_user_id);
--> statement-breakpoint
CREATE INDEX small_groups_co_leader_user_id_idx ON small_groups(co_leader_user_id);
