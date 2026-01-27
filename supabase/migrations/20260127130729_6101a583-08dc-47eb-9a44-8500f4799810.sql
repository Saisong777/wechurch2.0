-- Add icebreaker_enabled column to sessions table
ALTER TABLE public.sessions 
ADD COLUMN icebreaker_enabled boolean NOT NULL DEFAULT false;

-- Add to views as well
DROP VIEW IF EXISTS public.sessions_public;
CREATE VIEW public.sessions_public AS
SELECT 
  id,
  verse_reference,
  status,
  group_size,
  grouping_method,
  short_code,
  created_at,
  allow_latecomers,
  icebreaker_enabled
FROM public.sessions;

-- Grant access to the view
GRANT SELECT ON public.sessions_public TO anon, authenticated;