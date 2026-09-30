ALTER TABLE small_groups ADD COLUMN audience text NOT NULL DEFAULT 'unspecified'
 CHECK (audience IN ('unspecified','women','men','mixed','couples','other'));
ALTER TABLE small_groups ALTER COLUMN is_listed SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE life_group_requests ADD COLUMN message text NOT NULL DEFAULT '';
CREATE INDEX life_group_pending_requests ON life_group_requests(group_id,created_at) WHERE status='pending';
