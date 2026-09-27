CREATE INDEX IF NOT EXISTS devotional_notes_owner_visible_order_idx
  ON devotional_notes (user_id, (coalesce(source_devotional_date::timestamp, created_at)) DESC, created_at DESC)
  WHERE hidden = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS devotion_wall_feed_page_idx
  ON devotion_wall_posts (published_day, created_at DESC, id ASC)
  WHERE withdrawn_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS devotion_wall_owner_page_idx
  ON devotion_wall_posts (user_id, published_day, created_at DESC, id ASC)
  WHERE withdrawn_at IS NULL;
