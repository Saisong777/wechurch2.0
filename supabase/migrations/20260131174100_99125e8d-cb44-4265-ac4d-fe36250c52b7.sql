
-- Add policy for admins and leaders to view all profiles
CREATE POLICY "Leaders and admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'leader')
  )
);

-- Also add policy for potential_members table for leaders/admins
CREATE POLICY "Leaders and admins can view all potential_members"
ON public.potential_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'leader')
  )
);

-- Also add policy for user_roles table for leaders/admins to view roles
CREATE POLICY "Leaders and admins can view all user_roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'leader')
  )
);
