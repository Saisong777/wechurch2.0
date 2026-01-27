-- Add is_pinned column to prayers
ALTER TABLE public.prayers 
ADD COLUMN is_pinned boolean NOT NULL DEFAULT false;

-- Create notifications table
CREATE TABLE public.prayer_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prayer_id uuid NOT NULL REFERENCES public.prayers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('amen', 'comment')),
  actor_name text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prayer_notifications ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.prayer_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.prayer_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.prayer_notifications FOR DELETE
  USING (auth.uid() = user_id);

-- System can insert notifications (via trigger)
CREATE POLICY "System can insert notifications"
  ON public.prayer_notifications FOR INSERT
  WITH CHECK (true);

-- Update prayers policy to allow owners to update is_pinned
CREATE POLICY "Users can update their own prayers"
  ON public.prayers FOR UPDATE
  USING (auth.uid() = user_id);

-- Drop and recreate the view with is_pinned
DROP VIEW IF EXISTS public.v_prayer_wall;

CREATE VIEW public.v_prayer_wall WITH (security_invoker = on) AS
SELECT 
  p.id,
  p.content,
  p.is_anonymous,
  p.created_at,
  p.user_id,
  p.category,
  p.is_pinned,
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

-- Function to create notification on amen
CREATE OR REPLACE FUNCTION public.notify_on_amen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prayer_owner_id uuid;
  v_actor_name text;
BEGIN
  -- Get prayer owner
  SELECT user_id INTO v_prayer_owner_id FROM prayers WHERE id = NEW.prayer_id;
  
  -- Don't notify if user amens their own prayer
  IF v_prayer_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get actor name
  SELECT COALESCE(display_name, '某人') INTO v_actor_name FROM profiles WHERE user_id = NEW.user_id;
  
  -- Insert notification
  INSERT INTO prayer_notifications (user_id, prayer_id, type, actor_name)
  VALUES (v_prayer_owner_id, NEW.prayer_id, 'amen', v_actor_name);
  
  RETURN NEW;
END;
$$;

-- Function to create notification on comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prayer_owner_id uuid;
  v_actor_name text;
BEGIN
  -- Get prayer owner
  SELECT user_id INTO v_prayer_owner_id FROM prayers WHERE id = NEW.prayer_id;
  
  -- Don't notify if user comments on their own prayer
  IF v_prayer_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get actor name
  SELECT COALESCE(display_name, '某人') INTO v_actor_name FROM profiles WHERE user_id = NEW.user_id;
  
  -- Insert notification
  INSERT INTO prayer_notifications (user_id, prayer_id, type, actor_name)
  VALUES (v_prayer_owner_id, NEW.prayer_id, 'comment', v_actor_name);
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_notify_on_amen
  AFTER INSERT ON public.prayer_amens
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_amen();

CREATE TRIGGER trigger_notify_on_comment
  AFTER INSERT ON public.prayer_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_comment();