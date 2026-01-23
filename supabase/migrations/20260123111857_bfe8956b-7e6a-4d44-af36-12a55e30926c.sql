-- ================================================
-- FIX PARTICIPANTS TABLE RLS POLICIES
-- ================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow public read on participants" ON public.participants;
DROP POLICY IF EXISTS "Allow public update on participants" ON public.participants;
DROP POLICY IF EXISTS "Allow public insert on participants" ON public.participants;

-- ================================================
-- SELECT POLICIES
-- ================================================

-- Session owners can view all participants in their sessions
CREATE POLICY "Session owners can view their participants" 
  ON public.participants 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions 
      WHERE sessions.id = participants.session_id 
      AND sessions.owner_id = auth.uid()
    )
  );

-- Participants viewing their session: Since participants can be guests,
-- we allow SELECT for participants in active sessions (waiting/studying).
-- The realtime subscription already filters by session_id at the app layer.
-- This limits exposure to only active sessions within 24 hours.
CREATE POLICY "View participants in active sessions" 
  ON public.participants 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions 
      WHERE sessions.id = participants.session_id 
      AND sessions.status IN ('waiting', 'studying')
      AND sessions.created_at > now() - interval '24 hours'
    )
  );

-- ================================================
-- UPDATE POLICY - Only session owners can update
-- ================================================

CREATE POLICY "Session owners can update participants" 
  ON public.participants 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions 
      WHERE sessions.id = participants.session_id 
      AND sessions.owner_id = auth.uid()
    )
  );

-- ================================================
-- INSERT POLICY - Validated inserts only
-- ================================================

-- Allow inserts only to active sessions with basic validation
CREATE POLICY "Join active sessions with validation" 
  ON public.participants 
  FOR INSERT 
  WITH CHECK (
    -- Session must exist and be active
    EXISTS (
      SELECT 1 FROM public.sessions 
      WHERE sessions.id = session_id 
      AND sessions.status IN ('waiting', 'studying')
      AND sessions.created_at > now() - interval '24 hours'
    )
    -- Email must be valid format
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    -- Name must not be empty
    AND length(trim(name)) > 0
    -- Gender must be valid
    AND gender IN ('male', 'female')
  );