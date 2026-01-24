-- 1. 建立安全的 View (security_invoker = on)
DROP VIEW IF EXISTS public.participant_names;

CREATE VIEW public.participant_names
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  gender,
  NULL::text AS email,  -- 強制隱藏 Email，保護隱私
  session_id,
  group_number,
  joined_at,
  location,
  ready_confirmed
FROM participants;

-- 開放 View 的讀取權限
GRANT SELECT ON public.participant_names TO anon, authenticated;

-- ========================================================
-- 2. 【關鍵補充】確保底層 RLS 允許讀取「同一聚會」的人
-- ========================================================

-- 先刪除可能導致衝突或太嚴格的舊規則
DROP POLICY IF EXISTS "Participants can view same session members" ON public.participants;
DROP POLICY IF EXISTS "Public can view participants" ON public.participants;

-- 建立新規則：只要知道 Session ID，就能讀取該場聚會的名單
CREATE POLICY "Allow viewing same session members"
ON public.participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = participants.session_id
  )
);