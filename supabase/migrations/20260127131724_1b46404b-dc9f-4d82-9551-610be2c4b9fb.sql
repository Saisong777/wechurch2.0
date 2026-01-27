-- Add timer sync columns to icebreaker_games table
ALTER TABLE public.icebreaker_games
ADD COLUMN timer_duration integer DEFAULT 60,
ADD COLUMN timer_started_at timestamp with time zone,
ADD COLUMN timer_running boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.icebreaker_games.timer_duration IS 'Timer duration in seconds';
COMMENT ON COLUMN public.icebreaker_games.timer_started_at IS 'When the timer was started (for sync calculation)';
COMMENT ON COLUMN public.icebreaker_games.timer_running IS 'Whether the timer is currently running';