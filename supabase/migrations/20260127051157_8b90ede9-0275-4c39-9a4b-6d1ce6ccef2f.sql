-- 1. Add status column to ai_reports table for async processing support
ALTER TABLE public.ai_reports 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'COMPLETED' 
CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED'));

-- 2. Create a secure view for AI notes feed - NO emails or full UUIDs exposed
CREATE OR REPLACE VIEW public.v_ai_notes_feed
WITH (security_invoker = on)
AS
SELECT 
  sr.session_id,
  p.group_number,
  p.name AS first_name,
  sr.title_phrase,
  sr.heartbeat_verse,
  sr.observation,
  sr.core_insight_category,
  sr.core_insight_note,
  sr.scholars_note,
  sr.action_plan,
  sr.cool_down_note,
  sr.created_at
FROM study_responses sr
JOIN participants p ON p.session_id = sr.session_id 
  AND EXISTS (
    SELECT 1 FROM participants p2 
    WHERE p2.session_id = sr.session_id 
    AND p2.id::text = sr.user_id::text
    AND p2.id = p.id
  )
WHERE sr.title_phrase IS NOT NULL 
   OR sr.observation IS NOT NULL 
   OR sr.core_insight_note IS NOT NULL;

-- 3. Grant SELECT on the view to authenticated users (session owner will be enforced in edge function)
GRANT SELECT ON public.v_ai_notes_feed TO authenticated;

-- 4. Update ai_reports RLS to allow participants to view their group's report
DROP POLICY IF EXISTS "Participants can view their group report" ON public.ai_reports;

CREATE POLICY "Participants can view their group report"
ON public.ai_reports
FOR SELECT
USING (
  -- Session owners can view all
  EXISTS (
    SELECT 1 FROM sessions
    WHERE sessions.id = ai_reports.session_id
    AND sessions.owner_id = auth.uid()
  )
  OR
  -- Participants can view their group's report
  (
    report_type = 'group' AND
    EXISTS (
      SELECT 1 FROM participants p
      JOIN sessions s ON s.id = p.session_id
      WHERE p.session_id = ai_reports.session_id
      AND p.group_number = ai_reports.group_number
      AND LOWER(p.email) = LOWER(auth.jwt() ->> 'email')
      AND s.status IN ('studying', 'grouping', 'verification', 'completed')
    )
  )
  OR
  -- Anyone in the session can view overall reports
  (
    report_type = 'overall' AND
    EXISTS (
      SELECT 1 FROM participants p
      JOIN sessions s ON s.id = p.session_id
      WHERE p.session_id = ai_reports.session_id
      AND LOWER(p.email) = LOWER(auth.jwt() ->> 'email')
      AND s.status IN ('studying', 'grouping', 'verification', 'completed')
    )
  )
);

-- 5. Add index for faster status queries
CREATE INDEX IF NOT EXISTS idx_ai_reports_status ON public.ai_reports(session_id, status);