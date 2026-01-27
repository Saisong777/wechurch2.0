-- Create enum type for insight categories
CREATE TYPE public.insight_category_type AS ENUM ('PROMISE', 'COMMAND', 'WARNING', 'GOD_ATTRIBUTE');

-- Create study_responses table for the 7-step spiritual fitness workflow
CREATE TABLE public.study_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Phase 1: Warm-up (Green) - 暖身
  title_phrase TEXT,           -- 1. 定標題
  heartbeat_verse TEXT,        -- 2. 抓心跳
  observation TEXT,            -- 3. 看現場
  
  -- Phase 2: Core Training (Yellow) - 重訓
  core_insight_category insight_category_type,  -- 4. 練核心 (類別)
  core_insight_note TEXT,                       -- 4. 練核心 (內容)
  scholars_note TEXT,                           -- 5. 學長姐的話 (Open Book)
  
  -- Phase 3: Stretch (Blue) - 伸展
  action_plan TEXT,            -- 6. 帶一招
  cool_down_note TEXT,         -- 7. 自由發揮
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one response per user per session
  UNIQUE(session_id, user_id)
);

-- Enable RLS
ALTER TABLE public.study_responses ENABLE ROW LEVEL SECURITY;

-- Policy: Session owners can view all responses in their session
CREATE POLICY "Session owners can view all study responses"
  ON public.study_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = study_responses.session_id
        AND sessions.owner_id = auth.uid()
    )
  );

-- Policy: Participants can view their own response
CREATE POLICY "Users can view own study response"
  ON public.study_responses FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Participants can insert their own response
CREATE POLICY "Users can insert own study response"
  ON public.study_responses FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = study_responses.session_id
        AND sessions.status IN ('waiting', 'studying', 'grouping', 'verification')
        AND sessions.created_at > now() - interval '24 hours'
    )
  );

-- Policy: Users can update their own response
CREATE POLICY "Users can update own study response"
  ON public.study_responses FOR UPDATE
  USING (user_id = auth.uid());

-- Policy: Session owners can delete responses
CREATE POLICY "Session owners can delete study responses"
  ON public.study_responses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = study_responses.session_id
        AND sessions.owner_id = auth.uid()
    )
  );

-- Create secure view that masks email (joins with participants for user info)
CREATE VIEW public.study_responses_public
WITH (security_invoker = on) AS
SELECT 
  sr.id,
  sr.session_id,
  sr.user_id,
  p.name AS participant_name,
  p.group_number,
  NULL::text AS email,  -- Always mask email
  sr.title_phrase,
  sr.heartbeat_verse,
  sr.observation,
  sr.core_insight_category,
  sr.core_insight_note,
  sr.scholars_note,
  sr.action_plan,
  sr.cool_down_note,
  sr.created_at,
  sr.updated_at,
  -- Progress indicator based on filled fields
  CASE
    WHEN sr.action_plan IS NOT NULL OR sr.cool_down_note IS NOT NULL THEN 'stretching'
    WHEN sr.core_insight_category IS NOT NULL OR sr.scholars_note IS NOT NULL THEN 'heavy_lifting'
    WHEN sr.title_phrase IS NOT NULL OR sr.heartbeat_verse IS NOT NULL OR sr.observation IS NOT NULL THEN 'warming_up'
    ELSE 'not_started'
  END AS progress_status
FROM public.study_responses sr
LEFT JOIN public.participants p ON p.session_id = sr.session_id 
  AND EXISTS (
    SELECT 1 FROM public.participants p2 
    WHERE p2.session_id = sr.session_id 
      AND p2.id = p.id
  );

-- Trigger for updated_at
CREATE TRIGGER update_study_responses_updated_at
  BEFORE UPDATE ON public.study_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for study_responses
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_responses;