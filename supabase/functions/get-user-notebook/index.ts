import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing email parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Query all study responses for this user's email across all sessions
    // Join with participants to match by email, and sessions to get verse reference
    const { data: entries, error } = await supabase
      .from('study_responses')
      .select(`
        id,
        session_id,
        title_phrase,
        heartbeat_verse,
        observation,
        core_insight_category,
        core_insight_note,
        scholars_note,
        action_plan,
        cool_down_note,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[get-user-notebook] Query error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch notebook entries' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Now we need to filter by email and get session info
    // Get all participants with matching email
    const { data: participants, error: pError } = await supabase
      .from('participants')
      .select('id, session_id, email')
      .ilike('email', email);

    if (pError) {
      console.error('[get-user-notebook] Participants query error:', pError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch participant data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a map of participant_id -> session_id for this email
    const participantSessionMap = new Map<string, string>();
    (participants || []).forEach(p => {
      participantSessionMap.set(p.id, p.session_id);
    });

    // Get session info for all related sessions
    const sessionIds = [...new Set((participants || []).map(p => p.session_id))];
    const { data: sessions, error: sError } = await supabase
      .from('sessions')
      .select('id, verse_reference, created_at')
      .in('id', sessionIds);

    if (sError) {
      console.error('[get-user-notebook] Sessions query error:', sError);
    }

    const sessionMap = new Map<string, { verse_reference: string; created_at: string }>();
    (sessions || []).forEach(s => {
      sessionMap.set(s.id, { verse_reference: s.verse_reference, created_at: s.created_at });
    });

    // Filter entries to only those belonging to this user
    const participantIds = new Set([...participantSessionMap.keys()]);
    const userEntries = (entries || [])
      .filter(entry => {
        // user_id in study_responses is the participant id
        return participantIds.has(entry.id) || 
          // Also check by matching session_id + participant exists for that session
          [...participantSessionMap.entries()].some(
            ([pId, sId]) => sId === entry.session_id
          );
      })
      .map(entry => {
        const sessionInfo = sessionMap.get(entry.session_id);
        return {
          ...entry,
          verse_reference: sessionInfo?.verse_reference || 'Unknown',
          session_date: sessionInfo?.created_at || entry.created_at,
        };
      })
      // Sort by session date descending
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

    // Actually, let's do a proper join query
    // The user_id in study_responses references participants.id
    // So we need to find all study_responses where user_id matches a participant with this email

    const { data: properEntries, error: properError } = await supabase
      .from('study_responses')
      .select(`
        id,
        session_id,
        user_id,
        title_phrase,
        heartbeat_verse,
        observation,
        core_insight_category,
        core_insight_note,
        scholars_note,
        action_plan,
        cool_down_note,
        created_at
      `)
      .in('user_id', [...participantIds])
      .order('created_at', { ascending: false });

    if (properError) {
      console.error('[get-user-notebook] Proper query error:', properError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch study responses' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enrich with session info
    const enrichedEntries = (properEntries || []).map(entry => {
      const sessionInfo = sessionMap.get(entry.session_id);
      return {
        id: entry.id,
        session_id: entry.session_id,
        verse_reference: sessionInfo?.verse_reference || '經文',
        session_date: sessionInfo?.created_at || entry.created_at,
        title_phrase: entry.title_phrase,
        heartbeat_verse: entry.heartbeat_verse,
        observation: entry.observation,
        core_insight_category: entry.core_insight_category,
        core_insight_note: entry.core_insight_note,
        scholars_note: entry.scholars_note,
        action_plan: entry.action_plan,
        cool_down_note: entry.cool_down_note,
      };
    });

    console.log(`[get-user-notebook] Found ${enrichedEntries.length} entries for email: ${email.substring(0, 3)}***`);

    return new Response(
      JSON.stringify({ entries: enrichedEntries }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[get-user-notebook] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
