
-- Fix participants_public view - add security_invoker=on
DROP VIEW IF EXISTS public.participants_public;
CREATE VIEW public.participants_public
WITH (security_invoker=on) AS
SELECT 
  id,
  name AS display_name,
  gender,
  group_number,
  location,
  ready_confirmed AS status,
  session_id,
  joined_at
FROM participants p;

-- Fix sessions_public view - add security_invoker=on
DROP VIEW IF EXISTS public.sessions_public;
CREATE VIEW public.sessions_public
WITH (security_invoker=on) AS
SELECT 
  id,
  verse_reference,
  status,
  group_size,
  grouping_method,
  short_code,
  created_at,
  allow_latecomers,
  icebreaker_enabled
FROM sessions;

-- Fix study_responses_public view - add security_invoker=on (email already masked as NULL)
DROP VIEW IF EXISTS public.study_responses_public;
CREATE VIEW public.study_responses_public
WITH (security_invoker=on) AS
SELECT 
  sr.id,
  sr.session_id,
  sr.user_id,
  p.name AS participant_name,
  p.group_number,
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
  CASE
    WHEN ((sr.action_plan IS NOT NULL) OR (sr.cool_down_note IS NOT NULL)) THEN 'stretching'::text
    WHEN ((sr.core_insight_category IS NOT NULL) OR (sr.scholars_note IS NOT NULL)) THEN 'heavy_lifting'::text
    WHEN ((sr.title_phrase IS NOT NULL) OR (sr.heartbeat_verse IS NOT NULL) OR (sr.observation IS NOT NULL)) THEN 'warming_up'::text
    ELSE 'not_started'::text
  END AS progress_status
FROM study_responses sr
LEFT JOIN participants p ON ((p.id = sr.user_id) AND (p.session_id = sr.session_id));
