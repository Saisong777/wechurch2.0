const SOULGYM_EXPORT_DIR = "exports/soulgym";

const TABLES = [
  { table: "auth_users", orderBy: "created_at NULLS LAST, email NULLS LAST" },
  { table: "users", orderBy: "created_at NULLS LAST, email" },
  { table: "user_roles", orderBy: "created_at NULLS LAST" },
  { table: "sessions", orderBy: "created_at NULLS LAST" },
  { table: "participants", orderBy: "joined_at NULLS LAST" },
  { table: "submissions", orderBy: "submitted_at NULLS LAST" },
  { table: "study_responses", orderBy: "created_at NULLS LAST" },
  { table: "ai_reports", orderBy: "created_at NULLS LAST" },
  { table: "potential_members", orderBy: "created_at NULLS LAST, email" },
  { table: "card_questions", orderBy: "sort_order NULLS LAST, created_at NULLS LAST" },
  { table: "icebreaker_games", orderBy: "created_at NULLS LAST" },
  { table: "icebreaker_players", orderBy: "joined_at NULLS LAST" },
];

module.exports = {
  SOULGYM_EXPORT_DIR,
  TABLES,
};
