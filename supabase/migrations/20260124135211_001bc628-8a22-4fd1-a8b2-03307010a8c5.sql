-- ============================================================
-- 步驟 1: 設定 RLS Policy (邏輯核心)
-- ============================================================

DROP POLICY IF EXISTS "Public can view active sessions without owner info" ON public.sessions;

CREATE POLICY "Public can view active sessions without owner info"
ON public.sessions
FOR SELECT
TO public
USING (
  -- 規則 1: 擁有者可以看到自己所有的聚會
  (auth.uid() = owner_id)
  OR 
  -- 規則 2: 大眾可以看到 24 小時內的活躍聯會
  -- (包含 waiting, grouping, verification, studying 四種狀態)
  (
    status IN ('waiting', 'grouping', 'verification', 'studying')
    AND created_at > (now() - interval '24 hours')
  )
);

-- ============================================================
-- 步驟 2: 建立效能索引 (Performance Optimization)
-- ============================================================

-- 優化規則 1: 加速擁有者的查詢
CREATE INDEX IF NOT EXISTS idx_sessions_owner_id 
ON public.sessions (owner_id);

-- 優化規則 2: 加速大眾的狀態過濾與時間查詢
CREATE INDEX IF NOT EXISTS idx_sessions_status_created 
ON public.sessions (status, created_at);