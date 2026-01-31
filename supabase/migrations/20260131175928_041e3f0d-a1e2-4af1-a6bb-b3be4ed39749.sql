
-- Create trigger on profiles table to claim potential_member when a new profile is created
CREATE OR REPLACE TRIGGER on_profile_created_claim_potential_member
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.claim_potential_member();
