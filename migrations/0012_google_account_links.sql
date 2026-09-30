CREATE TABLE "google_account_links" (
  "google_subject" text PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id"),
  "auth_user_id" text NOT NULL UNIQUE REFERENCES "auth_users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);
