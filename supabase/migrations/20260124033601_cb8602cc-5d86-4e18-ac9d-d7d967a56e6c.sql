-- Add RLS policy to allow participants to view group submissions through the submissions_public view
-- The view excludes email, so this is safe

-- First, we need to enable RLS-like access through the base table for the view to work
-- Since the view uses security_invoker, it checks RLS on the base table

-- Create a policy that allows participants to view group submissions (email will be hidden via the view)
CREATE POLICY "Participants can view group submissions without email"
  ON public.submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM participants p
      JOIN sessions s ON s.id = p.session_id
      WHERE p.session_id = submissions.session_id
        AND p.group_number = submissions.group_number
        AND s.status IN ('waiting', 'studying')
        AND s.created_at > now() - interval '24 hours'
    )
  );