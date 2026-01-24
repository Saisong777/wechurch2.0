-- Add updated_at column to participants table if not exists
ALTER TABLE public.participants 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- RPC: 更新參加者準備狀態 (Optimized Version)
CREATE OR REPLACE FUNCTION public.set_participant_ready(
  p_session_id uuid,
  p_participant_id uuid,
  p_email text,
  p_ready boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  -- 1. 邏輯檢查：確保聚會處於允許互認的狀態
  IF NOT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = p_session_id
      AND status IN ('grouping', 'verification')
  ) THEN
    RETURN false;
  END IF;

  -- 2. 執行更新 (同時驗證身份)
  UPDATE public.participants
  SET 
    ready_confirmed = p_ready,
    updated_at = now()
  WHERE id = p_participant_id
    AND session_id = p_session_id
    AND email = p_email;

  -- 3. 檢查是否有資料被更新
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  RETURN v_updated > 0;
END;
$$;

-- 開放執行權限
GRANT EXECUTE ON FUNCTION public.set_participant_ready(uuid, uuid, text, boolean) TO anon, authenticated;