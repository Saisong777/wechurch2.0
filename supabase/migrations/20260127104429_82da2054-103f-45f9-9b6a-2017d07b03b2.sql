-- Add short_code column to sessions table
ALTER TABLE public.sessions 
ADD COLUMN short_code TEXT UNIQUE;

-- Create function to generate unique 4-character alphanumeric code
CREATE OR REPLACE FUNCTION public.generate_short_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude confusing chars (0, O, I, 1)
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
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM public.sessions WHERE short_code = result) THEN
      RETURN result;
    END IF;
    
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique short code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- Create trigger to auto-generate short_code on insert
CREATE OR REPLACE FUNCTION public.auto_generate_short_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.short_code IS NULL THEN
    NEW.short_code := generate_short_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_short_code
BEFORE INSERT ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_short_code();

-- Generate short codes for existing sessions that don't have one
DO $$
DECLARE
  sess RECORD;
BEGIN
  FOR sess IN SELECT id FROM public.sessions WHERE short_code IS NULL LOOP
    UPDATE public.sessions 
    SET short_code = generate_short_code() 
    WHERE id = sess.id;
  END LOOP;
END $$;

-- Update sessions_public view to include short_code
DROP VIEW IF EXISTS public.sessions_public;
CREATE VIEW public.sessions_public
WITH (security_invoker=on)
AS
  SELECT 
    id,
    short_code,
    verse_reference,
    status,
    allow_latecomers,
    group_size,
    grouping_method,
    created_at
  FROM public.sessions;