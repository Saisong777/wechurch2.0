-- Allow public INSERT for guest card downloads syncing to potential_members
-- This is safe because we only allow INSERT, not UPDATE/DELETE
CREATE POLICY "Allow public insert for card downloads"
ON public.potential_members
FOR INSERT
TO public
WITH CHECK (true);

-- Add comment to explain the policy
COMMENT ON POLICY "Allow public insert for card downloads" ON public.potential_members IS 
'Allows guest users who download message cards to be synced to the potential_members table';