-- Create a function to broadcast participant changes without sensitive data
CREATE OR REPLACE FUNCTION public.broadcast_participant_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
BEGIN
  -- Build a sanitized payload without email
  IF TG_OP = 'DELETE' THEN
    payload := jsonb_build_object(
      'type', 'participant_change',
      'event', TG_OP,
      'record', jsonb_build_object(
        'id', OLD.id,
        'session_id', OLD.session_id,
        'name', OLD.name,
        'gender', OLD.gender,
        'group_number', OLD.group_number,
        'joined_at', OLD.joined_at
      )
    );
  ELSE
    payload := jsonb_build_object(
      'type', 'participant_change',
      'event', TG_OP,
      'record', jsonb_build_object(
        'id', NEW.id,
        'session_id', NEW.session_id,
        'name', NEW.name,
        'gender', NEW.gender,
        'group_number', NEW.group_number,
        'joined_at', NEW.joined_at
      )
    );
  END IF;

  -- Broadcast to a session-specific channel
  PERFORM pg_notify(
    'participant_updates_' || COALESCE(NEW.session_id, OLD.session_id)::text,
    payload::text
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to broadcast sanitized participant changes
DROP TRIGGER IF EXISTS broadcast_participant_changes ON public.participants;
CREATE TRIGGER broadcast_participant_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.participants
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_participant_change();

-- Add a policy to allow viewing own participant record (for participants to see their own data)
-- This is needed so participants can verify their own registration
CREATE POLICY "Participants can view their own record"
  ON public.participants FOR SELECT
  USING (
    -- This allows a participant to read their own record via the is_verified_participant function
    -- But doesn't expose other participants' data
    false -- Deny direct SELECT - force use of participant_names view
  );

-- Note: The above policy is intentionally restrictive. Participants should use 
-- the participant_names view which excludes emails. Session owners already have
-- full SELECT access via "Session owners can view their participants" policy.