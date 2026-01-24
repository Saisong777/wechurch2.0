-- Create potential_members table for CRM tracking
CREATE TABLE public.potential_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  gender text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'member', 'declined')),
  subscribed boolean NOT NULL DEFAULT true,
  first_joined_at timestamptz NOT NULL DEFAULT now(),
  last_session_at timestamptz NOT NULL DEFAULT now(),
  sessions_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.potential_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies (NO public insert - only via trigger)
-- Admins and leaders can view all
CREATE POLICY "Leaders and admins can view potential_members"
  ON public.potential_members FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'leader')
  );

-- Admins can manage all records
CREATE POLICY "Admins can manage potential_members"
  ON public.potential_members FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Leaders can update (but not delete)
CREATE POLICY "Leaders can update potential_members"
  ON public.potential_members FOR UPDATE
  USING (public.has_role(auth.uid(), 'leader'));

-- Users can view their own record
CREATE POLICY "Users can view own potential_member record"
  ON public.potential_members FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their subscription status
CREATE POLICY "Users can update own subscription"
  ON public.potential_members FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger function: Sync participant to potential_members (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.sync_participant_to_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.potential_members (email, name, gender, first_joined_at, last_session_at, sessions_count)
  VALUES (NEW.email, NEW.name, NEW.gender, NEW.joined_at, NEW.joined_at, 1)
  ON CONFLICT (email) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, potential_members.name),
    gender = COALESCE(EXCLUDED.gender, potential_members.gender),
    last_session_at = EXCLUDED.last_session_at,
    sessions_count = potential_members.sessions_count + 1,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Create trigger on participants table
CREATE TRIGGER on_participant_insert_sync_member
  AFTER INSERT ON public.participants
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_participant_to_members();

-- Trigger function: Claim potential member when user signs up (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.claim_potential_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.potential_members
  SET 
    user_id = NEW.id,
    status = 'member',
    updated_at = now()
  WHERE email = NEW.email
    AND user_id IS NULL;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created_claim_member
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.claim_potential_member();

-- Add updated_at trigger
CREATE TRIGGER update_potential_members_updated_at
  BEFORE UPDATE ON public.potential_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.potential_members;