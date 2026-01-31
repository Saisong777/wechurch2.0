
-- Add non-recursive policy for leaders/admins to view user_roles using has_role()
-- This avoids the infinite recursion by using the security definer function
CREATE POLICY "Leaders and admins can view all user_roles via has_role"
ON public.user_roles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'leader'::public.app_role)
);
