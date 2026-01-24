-- Drop the old problematic SELECT policy (if it still exists from previous migration)
DROP POLICY IF EXISTS "Participants can view their own record" ON public.participants;
DROP POLICY IF EXISTS "Participants can view their own record by email" ON public.participants;

-- Create a proper function that only checks rate limiting, not duplicate prevention
-- The duplicate check should happen at the application layer where we can return existing records
CREATE OR REPLACE FUNCTION public.check_participant_rate_limit(p_session_id uuid, p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_joins INTEGER;
  already_in_session BOOLEAN;
BEGIN
  -- Check if already in this session - if so, allow (application layer handles returning existing record)
  SELECT EXISTS (
    SELECT 1 FROM participants 
    WHERE session_id = p_session_id AND email = p_email
  ) INTO already_in_session;
  
  -- If already joined, allow the insert to proceed (it will fail on unique constraint, but that's handled)
  -- Actually, we want to return TRUE here so application layer can handle re-entry
  IF already_in_session THEN
    RETURN true;
  END IF;
  
  -- For new participants, count joins from same email in last 5 minutes across any session
  SELECT COUNT(*) INTO recent_joins
  FROM participants
  WHERE email = p_email
    AND joined_at > now() - interval '5 minutes';
  
  -- Allow max 3 joins per email in 5 minutes
  RETURN recent_joins < 3;
END;
$$;