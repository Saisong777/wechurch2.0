-- Fix: allow participants to write/update study_responses when user_id stores participant_id
-- and authorization is based on the request JWT email.

ALTER TABLE public.study_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can insert study response" ON public.study_responses;
DROP POLICY IF EXISTS "Participants can update study response" ON public.study_responses;
DROP POLICY IF EXISTS "Participants can view own study response" ON public.study_responses;

-- INSERT: must match (session_id, user_id) to a participant row AND JWT email must match
CREATE POLICY "Participants can insert study response"
ON public.study_responses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.participants p
    JOIN public.sessions s ON s.id = p.session_id
    WHERE p.id = study_responses.user_id
      AND p.session_id = study_responses.session_id
      AND lower(p.email) = lower(auth.jwt() ->> 'email')
      AND s.status IN ('waiting','studying','grouping','verification')
      AND s.created_at > (now() - interval '24 hours')
  )
);

-- SELECT: same ownership rule (by participant id + JWT email) OR session owner
CREATE POLICY "Participants can view own study response"
ON public.study_responses
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.participants p
    JOIN public.sessions s ON s.id = p.session_id
    WHERE p.id = study_responses.user_id
      AND p.session_id = study_responses.session_id
      AND lower(p.email) = lower(auth.jwt() ->> 'email')
      AND s.created_at > (now() - interval '24 hours')
  )
);

-- UPDATE: allow participant to update their own row (same check as SELECT)
CREATE POLICY "Participants can update study response"
ON public.study_responses
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.participants p
    JOIN public.sessions s ON s.id = p.session_id
    WHERE p.id = study_responses.user_id
      AND p.session_id = study_responses.session_id
      AND lower(p.email) = lower(auth.jwt() ->> 'email')
      AND s.status IN ('waiting','studying','grouping','verification')
      AND s.created_at > (now() - interval '24 hours')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.participants p
    JOIN public.sessions s ON s.id = p.session_id
    WHERE p.id = study_responses.user_id
      AND p.session_id = study_responses.session_id
      AND lower(p.email) = lower(auth.jwt() ->> 'email')
      AND s.status IN ('waiting','studying','grouping','verification')
      AND s.created_at > (now() - interval '24 hours')
  )
);
