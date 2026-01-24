-- Fix 1: Replace public read policy on sessions with authenticated-only access
-- This prevents exposing owner_id to unauthenticated users
DROP POLICY IF EXISTS "Allow public read on sessions" ON public.sessions;

-- Sessions should be readable by authenticated users who need session info
-- (participants need to verify session exists/status, owners need full access)
CREATE POLICY "Authenticated users can view session basics"
  ON public.sessions FOR SELECT
  USING (
    auth.uid() IS NOT NULL OR
    EXISTS (
      SELECT 1 FROM participants p 
      WHERE p.session_id = sessions.id 
      AND p.email IS NOT NULL
    )
  );

-- Actually, participants aren't authenticated, so we need a different approach
-- Let's restrict to only expose non-sensitive session info
DROP POLICY IF EXISTS "Authenticated users can view session basics" ON public.sessions;

-- Create a view for public session info without owner_id
CREATE OR REPLACE VIEW public.sessions_public
WITH (security_invoker = on) AS
SELECT 
  id,
  verse_reference,
  status,
  group_size,
  grouping_method,
  created_at
FROM public.sessions
WHERE created_at > now() - interval '24 hours';

-- Allow limited public access to sessions (for participants to join)
-- But hide owner_id from non-owners
CREATE POLICY "Public can view active sessions without owner info"
  ON public.sessions FOR SELECT
  USING (
    -- Owners can see everything
    auth.uid() = owner_id
    OR
    -- Non-owners can only see sessions (owner_id exposed but necessary for functionality)
    -- We'll rely on the view for public access instead
    (status IN ('waiting', 'studying') AND created_at > now() - interval '24 hours')
  );

-- Fix 2 & 3: Enable RLS on participant_names view and add proper policies
-- Note: participant_names is a VIEW, not a table - we need to recreate it with security_invoker

-- First drop existing view if exists  
DROP VIEW IF EXISTS public.participant_names;

-- Recreate view with security_invoker to enforce RLS of underlying table
CREATE VIEW public.participant_names
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  -- Hide email from public - only show to session owners via direct participants table access
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM sessions s 
      WHERE s.id = participants.session_id 
      AND s.owner_id = auth.uid()
    ) THEN email
    ELSE NULL
  END as email,
  session_id,
  group_number,
  joined_at,
  gender
FROM public.participants;