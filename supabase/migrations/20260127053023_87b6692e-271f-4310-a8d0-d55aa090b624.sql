-- 1. Create index for case-insensitive email lookup (prevents timeout on mobile)
CREATE INDEX IF NOT EXISTS idx_participants_lower_email_session 
ON participants (session_id, lower(email));

-- 2. Reset Policies
ALTER TABLE study_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own study response" ON study_responses;
DROP POLICY IF EXISTS "Users can update own study response" ON study_responses;
DROP POLICY IF EXISTS "Users can view own study response" ON study_responses;
DROP POLICY IF EXISTS "Participants can insert study response" ON study_responses;
DROP POLICY IF EXISTS "Participants can update study response" ON study_responses;
DROP POLICY IF EXISTS "Participants can view own study response" ON study_responses;
DROP POLICY IF EXISTS "Admins can manage all" ON study_responses;

-- 3. INSERT Policy (Allow if Email is in Session)
CREATE POLICY "Participants can insert study response"
ON study_responses FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM participants p
    WHERE p.session_id = study_responses.session_id
    AND lower(p.email) = lower(auth.jwt() ->> 'email')
  )
  AND
  EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = study_responses.session_id
    AND s.status IN ('waiting', 'studying', 'grouping', 'verification')
  )
);

-- 4. SELECT Policy (View Own Data)
CREATE POLICY "Participants can view own study response"
ON study_responses FOR SELECT
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM participants p
    WHERE p.id = study_responses.user_id
    AND lower(p.email) = lower(auth.jwt() ->> 'email')
  )
);

-- 5. UPDATE Policy (Modify Own Data)
CREATE POLICY "Participants can update study response"
ON study_responses FOR UPDATE
USING (
  user_id = auth.uid()
  AND
  EXISTS (
    SELECT 1 FROM participants p
    WHERE p.session_id = study_responses.session_id
    AND lower(p.email) = lower(auth.jwt() ->> 'email')
  )
);

-- 6. Admin Override
CREATE POLICY "Admins can manage all"
ON study_responses FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));