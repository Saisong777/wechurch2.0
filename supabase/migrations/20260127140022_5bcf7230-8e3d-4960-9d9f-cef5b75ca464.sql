-- Add turn-based sharing fields to icebreaker_games table
ALTER TABLE public.icebreaker_games
ADD COLUMN IF NOT EXISTS current_drawer_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS current_drawer_card_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS drawer_order TEXT[] DEFAULT '{}';

-- Comment for clarity
COMMENT ON COLUMN public.icebreaker_games.current_drawer_id IS 'ID of the participant who is currently drawing/sharing';
COMMENT ON COLUMN public.icebreaker_games.current_drawer_card_id IS 'Card ID that the current drawer has drawn';
COMMENT ON COLUMN public.icebreaker_games.drawer_order IS 'Array of participant IDs in the order they will draw';