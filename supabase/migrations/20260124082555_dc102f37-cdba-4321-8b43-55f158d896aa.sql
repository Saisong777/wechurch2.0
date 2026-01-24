----------------------------------------------------------------
-- 1. 移除那個「太過危險」的全公開規則
----------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view participants" ON public.participants;

----------------------------------------------------------------
-- 2. 建立「擁有者」權限 (Lovable 的建議保留)
-- 擁有者可以看到所有詳細資料
----------------------------------------------------------------
DROP POLICY IF EXISTS "Session owners can view their participants" ON public.participants;

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

----------------------------------------------------------------
-- 3. 建立「同組可見」權限 (這是為了你的登入 & 互認功能)
-- 邏輯：只要該 Session 是存在的 (公開或進行中)，就允許讀取名單
-- 這樣訪客才能登入，組員才能互認
----------------------------------------------------------------
CREATE POLICY "Participants can view same session members"
ON public.participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = participants.session_id
    -- 可以選擇性加上狀態限制，例如只允許 waiting 或 studying 的聚會被讀取
    -- AND sessions.status = ANY (ARRAY['waiting'::text, 'studying'::text])
  )
);