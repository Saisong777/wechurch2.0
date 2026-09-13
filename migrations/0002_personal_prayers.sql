CREATE TABLE "personal_prayers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "title" text NOT NULL,
  "prayer" text NOT NULL,
  "response" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'waiting' NOT NULL,
  "response_type" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "personal_prayers_user_created_idx" ON "personal_prayers" ("user_id", "created_at");
