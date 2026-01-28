-- Create optimized view for high-concurrency participant list
-- This view exposes only non-sensitive data for public read access

CREATE OR REPLACE VIEW public.participants_public
WITH (security_invoker = false) AS
SELECT 
  p.id,
  p.name as display_name,
  p.gender,
  p.group_number,
  p.location,
  p.ready_confirmed as status,
  p.session_id,
  p.joined_at
FROM public.participants p;

-- Grant public read access to the view
GRANT SELECT ON public.participants_public TO anon, authenticated;

-- Create index for faster session filtering (if not exists)
CREATE INDEX IF NOT EXISTS idx_participants_session_id ON public.participants(session_id);

-- Create index for faster group filtering
CREATE INDEX IF NOT EXISTS idx_participants_session_group ON public.participants(session_id, group_number);

-- Create RPC function for efficient participant fetching with count
CREATE OR REPLACE FUNCTION public.get_session_participants(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'participants', COALESCE(json_agg(
      json_build_object(
        'id', p.id,
        'display_name', p.name,
        'gender', p.gender,
        'group_number', p.group_number,
        'location', p.location,
        'status', p.ready_confirmed,
        'joined_at', p.joined_at
      ) ORDER BY p.joined_at DESC
    ), '[]'::json),
    'total_count', COUNT(*)
  ) INTO result
  FROM participants p
  WHERE p.session_id = p_session_id;
  
  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_session_participants(uuid) TO anon, authenticated;