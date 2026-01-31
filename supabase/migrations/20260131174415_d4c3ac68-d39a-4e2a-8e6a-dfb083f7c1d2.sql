
-- Drop the incorrectly configured policies and recreate them as PERMISSIVE
DROP POLICY IF EXISTS "Leaders and admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Leaders and admins can view all potential_members" ON public.potential_members;
DROP POLICY IF EXISTS "Leaders and admins can view all user_roles" ON public.user_roles;

-- Recreate as PERMISSIVE policies (use AS PERMISSIVE explicitly)
CREATE POLICY "Leaders and admins can view all profiles"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'leader')
  )
);

CREATE POLICY "Leaders and admins can view all potential_members"
ON public.potential_members
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'leader')
  )
);

CREATE POLICY "Leaders and admins can view all user_roles"
ON public.user_roles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'leader')
  )
);
