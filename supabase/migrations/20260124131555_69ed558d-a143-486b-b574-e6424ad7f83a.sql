-- 1. 重建安全的 View，使用 security_invoker 繼承 RLS
DROP VIEW IF EXISTS public.participant_names;

CREATE VIEW public.participant_names
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  gender,
  NULL::text AS email,  -- 強制隱藏 Email
  session_id,
  group_number,
  joined_at,
  location,
  ready_confirmed
FROM participants;

-- 確保所有人都能讀取這個 View
GRANT SELECT ON public.participant_names TO anon, authenticated;

-- 2. 修改底層 RLS，允許讀取同一聚會的參與者
-- 先移除可能衝突的舊規則
DROP POLICY IF EXISTS "Participants can view same session members" ON public.participants;
DROP POLICY IF EXISTS "Public can view participants" ON public.participants;
DROP POLICY IF EXISTS "Allow viewing same session members" ON public.participants;

-- 建立新規則：只要 session 存在，就能讀取該場聚會的名單
-- (前端使用 View，Email 已被過濾，所以開放 SELECT 是安全的)
CREATE POLICY "Allow viewing same session members"
ON public.participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = participants.session_id
  )
);