-- Create prayer_comments table
CREATE TABLE public.prayer_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_id uuid NOT NULL REFERENCES public.prayers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prayer_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone authenticated can view comments"
  ON public.prayer_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own comments"
  ON public.prayer_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.prayer_comments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any comment"
  ON public.prayer_comments FOR DELETE
  USING (is_admin(auth.uid()));

-- Create a view for comments with author info
CREATE VIEW public.v_prayer_comments WITH (security_invoker = on) AS
SELECT 
  c.id,
  c.prayer_id,
  c.user_id,
  c.content,
  c.created_at,
  COALESCE(p.display_name, '未知用戶') AS author_name,
  p.avatar_url AS author_avatar,
  (c.user_id = auth.uid()) AS is_owner
FROM prayer_comments c
LEFT JOIN profiles p ON p.user_id = c.user_id;