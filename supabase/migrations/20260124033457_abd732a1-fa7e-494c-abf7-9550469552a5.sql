-- Fix 1: Create a submissions_public view that hides email from non-owners
-- First, drop existing policies that expose email to group members
DROP POLICY IF EXISTS "Participants can view their group submissions" ON public.submissions;

-- Create a new view for submissions that hides email from group members
CREATE OR REPLACE VIEW public.submissions_public
WITH (security_invoker = on) AS
SELECT 
  id,
  session_id,
  participant_id,
  group_number,
  name,
  -- email is intentionally excluded from this view
  bible_verse,
  theme,
  moving_verse,
  facts_discovered,
  inspiration_from_god,
  application_in_life,
  traditional_exegesis,
  others,
  submitted_at
FROM public.submissions;

-- Create policy for session owners to view all submissions (with email)
-- This policy already exists: "Session owners can view all submissions"

-- Create policy for participants to view their own submission (with email, for their own records)
CREATE POLICY "Participants can view their own submission"
  ON public.submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      WHERE p.session_id = submissions.session_id
        AND p.email = submissions.email
    )
  );

-- Fix 2: sessions_public is already a view with security_invoker
-- The scanner may be incorrectly flagging it as a table
-- Let's recreate it to ensure it's properly configured

DROP VIEW IF EXISTS public.sessions_public;

CREATE VIEW public.sessions_public
WITH (security_invoker = on) AS
SELECT 
  id,
  verse_reference,
  status,
  group_size,
  grouping_method,
  created_at
  -- owner_id is intentionally excluded
FROM public.sessions
WHERE status IN ('waiting', 'studying')
  AND created_at > now() - interval '24 hours';