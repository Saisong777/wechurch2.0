
-- Fix CRM visibility: remove recursive policy on user_roles and use has_role() security definer.

-- 1) Remove the recursive policy that triggers infinite recursion
DROP POLICY IF EXISTS "Leaders and admins can view all user_roles" ON public.user_roles;

-- 2) Replace policies that depend on querying user_roles under RLS with has_role() calls
DROP POLICY IF EXISTS "Leaders and admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Leaders and admins can view all potential_members" ON public.potential_members;

CREATE POLICY "Leaders and admins can view all profiles"
ON public.profiles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'leader'::public.app_role)
);

CREATE POLICY "Leaders and admins can view all potential_members"
ON public.potential_members
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'leader'::public.app_role)
);
