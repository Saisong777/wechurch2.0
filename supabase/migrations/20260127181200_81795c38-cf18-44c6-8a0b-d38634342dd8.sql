-- Create prayers table
CREATE TABLE public.prayers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create prayer_amens table with composite primary key to prevent double-voting
CREATE TABLE public.prayer_amens (
  prayer_id UUID REFERENCES public.prayers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (prayer_id, user_id)
);

-- Enable RLS
ALTER TABLE public.prayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_amens ENABLE ROW LEVEL SECURITY;

-- RLS for prayers
CREATE POLICY "Anyone authenticated can view prayers"
  ON public.prayers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own prayers"
  ON public.prayers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prayers"
  ON public.prayers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any prayer"
  ON public.prayers FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- RLS for prayer_amens
CREATE POLICY "Anyone authenticated can view amens"
  ON public.prayer_amens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own amens"
  ON public.prayer_amens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own amens"
  ON public.prayer_amens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create secure view for prayer wall (handles anonymous logic)
CREATE VIEW public.v_prayer_wall
WITH (security_invoker = on)
AS
SELECT 
  p.id,
  p.content,
  p.is_anonymous,
  p.created_at,
  p.user_id,
  CASE WHEN p.is_anonymous THEN '匿名' ELSE COALESCE(pr.display_name, '使用者') END AS author_name,
  CASE WHEN p.is_anonymous THEN NULL ELSE pr.avatar_url END AS author_avatar,
  (SELECT COUNT(*) FROM public.prayer_amens pa WHERE pa.prayer_id = p.id) AS amen_count,
  (p.user_id = auth.uid()) AS is_owner,
  EXISTS(SELECT 1 FROM public.prayer_amens pa WHERE pa.prayer_id = p.id AND pa.user_id = auth.uid()) AS has_amened
FROM public.prayers p
LEFT JOIN public.profiles pr ON p.user_id = pr.user_id
ORDER BY p.created_at DESC;

-- Enable realtime for prayers and amens
ALTER PUBLICATION supabase_realtime ADD TABLE public.prayers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prayer_amens;