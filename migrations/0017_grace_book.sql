ALTER TABLE personal_prayers ADD COLUMN record_kind text NOT NULL DEFAULT 'prayer';
--> statement-breakpoint
ALTER TABLE personal_prayers ADD COLUMN occurred_on date;
--> statement-breakpoint
ALTER TABLE personal_prayers ADD CONSTRAINT personal_prayers_record_kind_check CHECK (record_kind IN ('prayer', 'grace'));
--> statement-breakpoint
ALTER TABLE personal_prayers ADD CONSTRAINT personal_prayers_grace_record_check CHECK (
  record_kind <> 'grace' OR (occurred_on IS NOT NULL AND status = 'answered' AND response_type IS NOT DISTINCT FROM 'grace' AND length(trim(prayer)) > 0)
);
