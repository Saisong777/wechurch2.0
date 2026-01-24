-- Create a security definer function to check if participant exists and return their data
-- This allows participants to retrieve their own record during re-entry without exposing others' data
CREATE OR REPLACE FUNCTION public.get_participant_for_reentry(p_session_id uuid, p_email text)
RETURNS TABLE (
  id uuid,
  name text,
  gender text,
  group_number integer,
  joined_at timestamptz,
  location text,
  ready_confirmed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.gender,
    p.group_number,
    p.joined_at,
    p.location,
    p.ready_confirmed
  FROM participants p
  WHERE p.session_id = p_session_id 
    AND p.email = p_email;
END;
$$;