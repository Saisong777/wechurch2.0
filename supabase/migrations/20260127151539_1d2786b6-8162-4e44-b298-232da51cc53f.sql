-- Fix the duplicate issue in study_responses_public view
-- The bug was: joining participants on session_id only, causing cross-join
-- Fix: also join on user_id = p.id

DROP VIEW IF EXISTS public.study_responses_public;

CREATE VIEW public.study_responses_public AS
SELECT 
    sr.id,
    sr.session_id,
    sr.user_id,
    p.name AS participant_name,
    p.group_number,
    NULL::text AS email,  -- Privacy: never expose email
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
        WHEN sr.action_plan IS NOT NULL OR sr.cool_down_note IS NOT NULL THEN 'stretching'::text
        WHEN sr.core_insight_category IS NOT NULL OR sr.scholars_note IS NOT NULL THEN 'heavy_lifting'::text
        WHEN sr.title_phrase IS NOT NULL OR sr.heartbeat_verse IS NOT NULL OR sr.observation IS NOT NULL THEN 'warming_up'::text
        ELSE 'not_started'::text
    END AS progress_status
FROM study_responses sr
LEFT JOIN participants p ON p.id = sr.user_id AND p.session_id = sr.session_id;