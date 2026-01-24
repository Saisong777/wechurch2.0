-- Drop the broken policy that returns false
DROP POLICY IF EXISTS "Participants can view their own record" ON public.participants;

-- Create a proper policy that allows participants to view their own record by email
-- This allows the re-entry check to work properly
CREATE POLICY "Participants can view their own record by email"
ON public.participants
FOR SELECT
USING (email = current_setting('request.jwt.claims', true)::json->>'email');

-- Also create an anon-friendly policy for checking existence during join
-- This allows anonymous users to check if they already joined (for guest users)
CREATE POLICY "Allow checking own participation by email"
ON public.participants
FOR SELECT
USING (true);

-- But we need to be careful - we don't want to expose all participant data
-- Let's drop that overly permissive policy and create a more targeted one
DROP POLICY IF EXISTS "Allow checking own participation by email" ON public.participants;