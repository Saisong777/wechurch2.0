ALTER TABLE users ADD COLUMN church_choice_locked boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN church_login_seen boolean NOT NULL DEFAULT false;
UPDATE users SET church_choice_locked=true WHERE church IS NOT NULL OR EXISTS (
 SELECT 1 FROM church_affiliation_events e WHERE e.user_id=users.id AND (e.previous_church IS NOT NULL OR e.next_church IS NOT NULL));
-- Existing accounts are not falsely described as brand-new members after deployment.
UPDATE users SET church_login_seen=true;
ALTER TABLE church_affiliation_events ADD COLUMN source text NOT NULL DEFAULT 'admin';
ALTER TABLE church_affiliation_events ADD COLUMN request_id uuid;
CREATE UNIQUE INDEX church_affiliation_request ON church_affiliation_events(user_id,request_id) WHERE request_id IS NOT NULL;
CREATE TABLE church_login_receipts (
 receipt_id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id),church text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX church_login_receipts_user ON church_login_receipts(user_id,created_at);
CREATE TABLE church_login_daily (
 church text NOT NULL,user_id uuid NOT NULL REFERENCES users(id),day date NOT NULL,
 first_login_at timestamptz NOT NULL,last_login_at timestamptz NOT NULL,login_count integer NOT NULL DEFAULT 1,
 PRIMARY KEY(church,user_id,day),CHECK(login_count>0)
);
CREATE TABLE church_member_arrivals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id),church text,
 reason text NOT NULL CHECK(reason IN ('first_login','initial_choice','church_changed','needs_affiliation')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','handled')),version integer NOT NULL DEFAULT 1,
 handled_by uuid REFERENCES users(id),handled_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX church_arrivals_user_scope ON church_member_arrivals(user_id,coalesce(church,''));
CREATE INDEX church_arrivals_pending ON church_member_arrivals(church,created_at,id) WHERE status='pending';
CREATE TABLE church_login_digest_reads (
 user_id uuid NOT NULL REFERENCES users(id),church text NOT NULL,day date NOT NULL,read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,church,day)
);
-- Commit the receipt and notifications atomically with the actual Passport session.
-- Session logout/expiry/replacement cannot discard an unrecorded successful login.
CREATE FUNCTION record_church_session_login() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE identity jsonb; member users%ROWTYPE; receipt uuid; happened timestamptz; scope text; inserted uuid;
BEGIN
 identity := NEW.sess->'passport'->'user';
 IF identity->>'loginReceiptId' IS NULL THEN RETURN NEW; END IF;
 receipt := (identity->>'loginReceiptId')::uuid;
 happened := replace(identity->>'loginReceiptAt','Z','+00:00')::timestamptz;
 IF happened IS NULL OR happened<'2000-01-01'::timestamptz OR happened>clock_timestamp()+interval '1 minute' THEN RAISE EXCEPTION 'Invalid login receipt timestamp'; END IF;
 IF EXISTS(SELECT 1 FROM church_login_receipts WHERE receipt_id=receipt AND user_id=(identity->>'sessionUserId')::uuid) THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('church-affiliation:' || (identity->>'sessionUserId')));
 IF EXISTS(SELECT 1 FROM church_login_receipts WHERE receipt_id=receipt) THEN
  IF NOT EXISTS(SELECT 1 FROM church_login_receipts WHERE receipt_id=receipt AND user_id=(identity->>'sessionUserId')::uuid) THEN RAISE EXCEPTION 'Login receipt owner mismatch'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO member FROM users WHERE id=(identity->>'sessionUserId')::uuid FOR UPDATE;
 IF NOT FOUND OR member.session_version IS DISTINCT FROM (identity->>'sessionVersion')::integer THEN RAISE EXCEPTION 'Unverified login receipt binding'; END IF;
 scope := CASE regexp_replace(lower(trim(member.church)), '[[:space:]''’]', '', 'g')
  WHEN 'im行動教會' THEN 'IM 行動教會' WHEN 'imchurch' THEN 'IM 行動教會' WHEN 'im' THEN 'IM 行動教會'
  WHEN '桃園wechurch' THEN '桃園WeChurch' WHEN '火樂' THEN '火樂' WHEN '火樂教會' THEN '火樂' ELSE NULL END;
 INSERT INTO church_login_receipts(receipt_id,user_id,church,created_at) VALUES(receipt,member.id,scope,happened) RETURNING receipt_id INTO inserted;
 BEGIN
  INSERT INTO church_login_daily(church,user_id,day,first_login_at,last_login_at) VALUES(coalesce(scope,'__unassigned'),member.id,(happened AT TIME ZONE 'Asia/Taipei')::date,happened,happened)
  ON CONFLICT(church,user_id,day) DO UPDATE SET first_login_at=LEAST(church_login_daily.first_login_at,EXCLUDED.first_login_at),last_login_at=GREATEST(church_login_daily.last_login_at,EXCLUDED.last_login_at),login_count=church_login_daily.login_count+1;
 END;
 IF NOT member.church_login_seen OR scope IS NULL THEN
  INSERT INTO church_member_arrivals(user_id,church,reason) VALUES(member.id,scope,CASE WHEN scope IS NULL THEN 'needs_affiliation' ELSE 'first_login' END)
  ON CONFLICT(user_id,(coalesce(church,''))) DO NOTHING;
 END IF;
 UPDATE users SET church_login_seen=true WHERE id=member.id;
 RETURN NEW;
END $$;
CREATE TRIGGER church_session_login_receipt AFTER INSERT OR UPDATE OF sess ON auth_sessions FOR EACH ROW EXECUTE FUNCTION record_church_session_login();
