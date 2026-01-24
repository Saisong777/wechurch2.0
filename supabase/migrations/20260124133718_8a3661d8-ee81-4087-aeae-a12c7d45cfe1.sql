-- ==========================================
-- 1. Schema 修改
-- ==========================================
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS allow_latecomers boolean NOT NULL DEFAULT false;

-- 更新 View 以包含新欄位
DROP VIEW IF EXISTS public.sessions_public;
CREATE VIEW public.sessions_public WITH (security_invoker = on) AS
SELECT 
  id,
  verse_reference,
  status,
  group_size,
  grouping_method,
  created_at,
  allow_latecomers
FROM sessions
WHERE status IN ('waiting', 'grouping', 'studying', 'verification')
  AND created_at > now() - interval '24 hours';

-- ==========================================
-- 2. 更新加入規則 (RLS Policy)
-- ==========================================

-- 先刪除舊規則
DROP POLICY IF EXISTS "Join active sessions with rate limiting" ON public.participants;

-- 建立支援「遲到者」的新規則
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
        AND (
          sessions.status = 'waiting'
          OR
          (
             sessions.allow_latecomers = true 
             AND sessions.status IN ('grouping', 'verification', 'studying')
          )
        )
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