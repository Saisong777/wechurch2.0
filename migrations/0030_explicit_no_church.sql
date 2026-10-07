-- Distinguish an explicit first-login choice from an unconfirmed/cleared affiliation.
-- Existing accounts retain their church and selection lock unchanged.
ALTER TABLE users ADD COLUMN church_choice_none boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD CONSTRAINT users_church_choice_none_valid
  CHECK (NOT church_choice_none OR (church IS NULL AND church_choice_locked));
