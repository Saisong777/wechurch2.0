-- Add location column to participants table for multi-site grouping
ALTER TABLE public.participants
ADD COLUMN location text NOT NULL DEFAULT 'On-site';

-- Add ready_confirmed column for group verification
ALTER TABLE public.participants
ADD COLUMN ready_confirmed boolean NOT NULL DEFAULT false;

-- Drop the existing view first
DROP VIEW IF EXISTS public.participant_names;

-- Recreate participant_names view with new columns (still hide email)
CREATE VIEW public.participant_names AS
SELECT 
  id,
  name,
  gender,
  NULL::text as email,  -- Hide email from non-owners
  session_id,
  group_number,
  joined_at,
  location,
  ready_confirmed
FROM public.participants;

-- Grant access to the view
GRANT SELECT ON public.participant_names TO anon, authenticated;