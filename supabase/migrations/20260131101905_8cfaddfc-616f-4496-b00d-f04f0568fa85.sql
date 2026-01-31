-- Create message_cards table for storing uploaded images
CREATE TABLE public.message_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  image_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create message_card_downloads table for tracking downloads
CREATE TABLE public.message_card_downloads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.message_cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create storage bucket for message card images
INSERT INTO storage.buckets (id, name, public) VALUES ('message-cards', 'message-cards', true);

-- Enable RLS on message_cards
ALTER TABLE public.message_cards ENABLE ROW LEVEL SECURITY;

-- Admins can do everything on message_cards
CREATE POLICY "Admins can manage message cards"
ON public.message_cards
FOR ALL
USING (public.is_admin(auth.uid()));

-- Anyone can read active message cards (needed for download page)
CREATE POLICY "Anyone can view active message cards"
ON public.message_cards
FOR SELECT
USING (is_active = true);

-- Enable RLS on message_card_downloads
ALTER TABLE public.message_card_downloads ENABLE ROW LEVEL SECURITY;

-- Admins can view all downloads
CREATE POLICY "Admins can view all downloads"
ON public.message_card_downloads
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Anyone can insert download records (to track their own download)
CREATE POLICY "Anyone can record their download"
ON public.message_card_downloads
FOR INSERT
WITH CHECK (true);

-- Storage policies for message-cards bucket
CREATE POLICY "Admins can upload message cards"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'message-cards' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete message cards"
ON storage.objects
FOR DELETE
USING (bucket_id = 'message-cards' AND public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view message cards"
ON storage.objects
FOR SELECT
USING (bucket_id = 'message-cards');

-- Function to generate unique 4-digit short code for message cards
CREATE OR REPLACE FUNCTION public.generate_card_short_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
  attempts INTEGER := 0;
  max_attempts INTEGER := 100;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..4 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    IF NOT EXISTS (SELECT 1 FROM public.message_cards WHERE short_code = result) THEN
      RETURN result;
    END IF;
    
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique short code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- Trigger to auto-generate short code
CREATE OR REPLACE FUNCTION public.auto_generate_card_short_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.short_code IS NULL OR NEW.short_code = '' THEN
    NEW.short_code := generate_card_short_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_card_short_code_trigger
BEFORE INSERT ON public.message_cards
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_card_short_code();