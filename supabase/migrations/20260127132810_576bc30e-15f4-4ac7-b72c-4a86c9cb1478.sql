-- Add sharing activity columns to icebreaker_games table
-- This allows tracking which group members have finished sharing during the icebreaker activity

-- Add sharing_mode column to track if the group is in "sharing mode" (turn-by-turn sharing)
ALTER TABLE public.icebreaker_games
ADD COLUMN IF NOT EXISTS sharing_mode BOOLEAN NOT NULL DEFAULT false;

-- Add shared_member_ids to track which members have finished sharing
ALTER TABLE public.icebreaker_games
ADD COLUMN IF NOT EXISTS shared_member_ids UUID[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.icebreaker_games.sharing_mode IS 'Whether the group is currently in turn-by-turn sharing mode';
COMMENT ON COLUMN public.icebreaker_games.shared_member_ids IS 'Array of participant IDs who have finished sharing';