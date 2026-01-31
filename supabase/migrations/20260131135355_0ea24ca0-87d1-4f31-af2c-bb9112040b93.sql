-- Create feature_toggles table for managing feature availability
CREATE TABLE public.feature_toggles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key TEXT NOT NULL UNIQUE,
  feature_name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  disabled_message TEXT DEFAULT '即將推出',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.feature_toggles ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read feature toggles (public visibility)
CREATE POLICY "Anyone can view feature toggles"
ON public.feature_toggles
FOR SELECT
USING (true);

-- Only admins can update feature toggles
CREATE POLICY "Admins can update feature toggles"
ON public.feature_toggles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can insert feature toggles
CREATE POLICY "Admins can insert feature toggles"
ON public.feature_toggles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Insert default feature toggles
INSERT INTO public.feature_toggles (feature_key, feature_name, description, is_enabled, disabled_message) VALUES
('we_live', 'We Live 靈魂健身房', '查經與小組討論功能', true, '功能維護中'),
('we_learn', 'We Learn 學習成長', '聖經研讀與屬靈資源', false, '即將推出'),
('we_play', 'We Play 破冰遊戲', '破冰卡牌遊戲功能', true, '功能維護中'),
('we_share', 'We Share 分享代禱', '禱告牆與信息圖卡', true, '功能維護中'),
('prayer_wall', '禱告牆', 'We Share 下的禱告牆功能', true, '功能維護中'),
('message_cards', '信息圖卡', 'We Share 下的經文圖卡分享', true, '功能維護中'),
('icebreaker_game', '破冰卡牌遊戲', 'We Play 下的破冰遊戲', true, '功能維護中');

-- Enable realtime for feature toggles
ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_toggles;