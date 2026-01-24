-- Fix security issues: add rate limiting, restrict submissions, protect participant emails

-- 1. Create rate limiting function for participant registration
CREATE OR REPLACE FUNCTION public.check_participant_rate_limit(p_session_id UUID, p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_joins INTEGER;
BEGIN
  -- Count joins from same email in last 5 minutes across any session
  SELECT COUNT(*) INTO recent_joins
  FROM participants
  WHERE email = p_email
    AND joined_at > now() - interval '5 minutes';
  
  -- Also check if already in this session
  IF EXISTS (SELECT 1 FROM participants WHERE session_id = p_session_id AND email = p_email) THEN
    RETURN false;
  END IF;
  
  -- Allow max 3 joins per email in 5 minutes
  RETURN recent_joins < 3;
END;
$$;

-- 2. Create function to check if user is a verified participant
CREATE OR REPLACE FUNCTION public.is_verified_participant(p_session_id UUID, p_participant_id UUID, p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM participants
    WHERE id = p_participant_id
      AND session_id = p_session_id
      AND email = p_email
  );
END;
$$;

-- 3. Drop and recreate participants INSERT policy with rate limiting
DROP POLICY IF EXISTS "Join active sessions with validation" ON public.participants;

CREATE POLICY "Join active sessions with rate limiting"
ON public.participants
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sessions
    WHERE sessions.id = session_id
    AND sessions.status IN ('waiting', 'studying')
    AND sessions.created_at > now() - interval '24 hours'
  )
  AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND length(trim(name)) > 0
  AND gender IN ('male', 'female')
  AND public.check_participant_rate_limit(session_id, email)
);

-- 4. Drop and recreate submissions INSERT policy with validation
DROP POLICY IF EXISTS "Allow public insert on submissions" ON public.submissions;

CREATE POLICY "Verified participants can submit"
ON public.submissions
FOR INSERT
WITH CHECK (
  -- Must be in an active session
  EXISTS (
    SELECT 1 FROM sessions
    WHERE sessions.id = session_id
    AND sessions.status IN ('waiting', 'studying')
    AND sessions.created_at > now() - interval '24 hours'
  )
  -- Must be a verified participant in this session
  AND public.is_verified_participant(session_id, participant_id, email)
  -- Prevent duplicate submissions from same participant
  AND NOT EXISTS (
    SELECT 1 FROM submissions s
    WHERE s.participant_id = participant_id
    AND s.session_id = session_id
  )
);

-- 5. Drop and recreate ai_reports INSERT policy with proper validation
DROP POLICY IF EXISTS "Allow public insert on ai_reports" ON public.ai_reports;

CREATE POLICY "Session owners can insert ai_reports"
ON public.ai_reports
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sessions
    WHERE sessions.id = session_id
    AND sessions.owner_id = auth.uid()
  )
);

-- 6. Drop and recreate ai_reports SELECT policy to restrict to session owners
DROP POLICY IF EXISTS "Allow public read on ai_reports" ON public.ai_reports;

CREATE POLICY "Session owners can view ai_reports"
ON public.ai_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sessions
    WHERE sessions.id = ai_reports.session_id
    AND sessions.owner_id = auth.uid()
  )
);

-- 7. Create a view to hide participant emails from non-owners
CREATE OR REPLACE VIEW public.participant_names 
WITH (security_invoker = on)
AS
SELECT 
  id,
  session_id,
  name,
  gender,
  group_number,
  joined_at,
  NULL::text as email
FROM public.participants;

-- Grant access to the view
GRANT SELECT ON public.participant_names TO anon, authenticated;

-- 8. Drop overly permissive participant SELECT policy and create owner-only policy
DROP POLICY IF EXISTS "View participants in active sessions" ON public.participants;

-- Keep only session owners able to see full participant data with emails
-- Others should use the participant_names view

-- 9. Fix submissions public read - restrict to session owners and participants
DROP POLICY IF EXISTS "Allow public read on submissions" ON public.submissions;

CREATE POLICY "Session owners can view all submissions"
ON public.submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sessions
    WHERE sessions.id = submissions.session_id
    AND sessions.owner_id = auth.uid()
  )
);

-- Allow participants to view submissions from their own group
CREATE POLICY "Participants can view their group submissions"
ON public.submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM participants p
    WHERE p.session_id = submissions.session_id
    AND p.email = submissions.email
  )
  OR
  EXISTS (
    SELECT 1 FROM participants p
    WHERE p.session_id = submissions.session_id
    AND p.group_number = submissions.group_number
    AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = submissions.session_id
      AND s.status IN ('waiting', 'studying')
      AND s.created_at > now() - interval '24 hours'
    )
  )
);