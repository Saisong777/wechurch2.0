-- Fix participants INSERT policy: check_participant_rate_limit argument order was reversed,
-- causing all joins to fail with "new row violates row-level security policy".

DROP POLICY IF EXISTS "Join active sessions with rate limiting" ON public.participants;

CREATE POLICY "Join active sessions with rate limiting"
ON public.participants
FOR INSERT
TO public
WITH CHECK (
  (
    EXISTS (
      SELECT 1
      FROM public.sessions
      WHERE sessions.id = participants.session_id
        AND sessions.status = ANY (ARRAY['waiting'::text, 'studying'::text])
        AND sessions.created_at > (now() - '24:00:00'::interval)
    )
  )
  AND (participants.email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)
  AND (length(trim(both from participants.name)) > 0)
  AND (participants.gender = ANY (ARRAY['male'::text, 'female'::text]))
  AND public.check_participant_rate_limit(
    p_email := participants.email,
    p_session_id := participants.session_id
  )
);
