-- RPC Function: seed_mock_participants
-- Generates mock participants for stress testing
CREATE OR REPLACE FUNCTION public.seed_mock_participants(p_session_id uuid, p_count integer DEFAULT 50)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INTEGER;
  inserted_count INTEGER := 0;
  first_names_male TEXT[] := ARRAY['志明', '建宏', '家豪', '俊傑', '文華', '國榮', '偉強', '永康', '明德', '子軒'];
  first_names_female TEXT[] := ARRAY['淑芬', '美玲', '雅婷', '怡君', '佳蓉', '欣怡', '惠如', '靜怡', '佩君', '詩涵'];
  last_names TEXT[] := ARRAY['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪'];
  locations TEXT[] := ARRAY['On-site', 'Online - 台北', 'Online - 新竹', 'Online - 台中', 'Online - 高雄'];
  v_gender TEXT;
  v_name TEXT;
  v_location TEXT;
  v_email TEXT;
BEGIN
  -- Validate session exists
  IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_session_id) THEN
    RETURN json_build_object('success', false, 'error', 'Session not found', 'inserted', 0);
  END IF;

  -- Limit count to prevent abuse
  IF p_count > 200 THEN
    p_count := 200;
  END IF;

  FOR i IN 1..p_count LOOP
    -- Random gender (50/50)
    v_gender := CASE WHEN random() > 0.5 THEN 'male' ELSE 'female' END;
    
    -- Random name based on gender
    IF v_gender = 'male' THEN
      v_name := last_names[1 + floor(random() * array_length(last_names, 1))::int] || 
                first_names_male[1 + floor(random() * array_length(first_names_male, 1))::int];
    ELSE
      v_name := last_names[1 + floor(random() * array_length(last_names, 1))::int] || 
                first_names_female[1 + floor(random() * array_length(first_names_female, 1))::int];
    END IF;
    
    -- 70% on-site, 30% remote
    v_location := CASE WHEN random() > 0.3 THEN 'On-site' 
                       ELSE locations[2 + floor(random() * 4)::int] END;
    
    -- Generate unique mock email
    v_email := 'mock_' || i || '_' || extract(epoch from now())::bigint || '@test.local';
    
    BEGIN
      INSERT INTO participants (session_id, name, email, gender, location, ready_confirmed)
      VALUES (p_session_id, v_name, v_email, v_gender, v_location, random() > 0.3);
      inserted_count := inserted_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Continue on individual insert failure
      NULL;
    END;
  END LOOP;

  RETURN json_build_object(
    'success', true, 
    'inserted', inserted_count,
    'requested', p_count
  );
END;
$$;

-- RPC Function: clear_mock_participants
-- Removes mock participants (emails ending in @test.local)
CREATE OR REPLACE FUNCTION public.clear_mock_participants(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM participants 
  WHERE session_id = p_session_id 
    AND email LIKE '%@test.local';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true,
    'deleted', deleted_count
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.seed_mock_participants(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_mock_participants(uuid) TO authenticated;