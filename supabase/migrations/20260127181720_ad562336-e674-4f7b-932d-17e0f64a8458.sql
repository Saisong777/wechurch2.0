-- Create enum for prayer categories
CREATE TYPE public.prayer_category AS ENUM ('thanksgiving', 'supplication', 'praise', 'other');

-- Add category column to prayers table
ALTER TABLE public.prayers 
ADD COLUMN category public.prayer_category NOT NULL DEFAULT 'other';

-- Drop and recreate the view to include category
DROP VIEW IF EXISTS public.v_prayer_wall;

CREATE VIEW public.v_prayer_wall WITH (security_invoker = on) AS
SELECT 
  p.id,
  p.content,
  p.is_anonymous,
  p.created_at,
  p.user_id,
  p.category,
  CASE WHEN p.is_anonymous THEN '匿名' ELSE COALESCE(profiles.display_name, '未知用戶') END AS author_name,
  CASE WHEN p.is_anonymous THEN NULL ELSE profiles.avatar_url END AS author_avatar,
  COALESCE(amen_counts.count, 0)::integer AS amen_count,
  (p.user_id = auth.uid()) AS is_owner,
  EXISTS (
    SELECT 1 FROM prayer_amens pa 
    WHERE pa.prayer_id = p.id AND pa.user_id = auth.uid()
  ) AS has_amened
FROM prayers p
LEFT JOIN profiles ON profiles.user_id = p.user_id
LEFT JOIN (
  SELECT prayer_id, COUNT(*) as count 
  FROM prayer_amens 
  GROUP BY prayer_id
) amen_counts ON amen_counts.prayer_id = p.id;