-- Fix security definer view issue by recreating with security_invoker
DROP VIEW IF EXISTS public.participant_names;

-- Recreate with security_invoker to enforce RLS of querying user
CREATE VIEW public.participant_names 
WITH (security_invoker = on) AS
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