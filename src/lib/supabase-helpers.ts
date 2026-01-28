import { supabase } from "@/integrations/supabase/client";
import { Session, User, StudySubmission, GroupingSettings, Group } from "@/types/bible-study";

// Generic error message for client-side display
const GENERIC_ERROR = "An error occurred. Please try again.";

// Session functions
export const createSession = async (verseReference: string): Promise<Session | null> => {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ verse_reference: verseReference, status: "waiting" })
    .select()
    .single();

  if (error) {
    // Error logged server-side by Supabase - return null to client
    return null;
  }

  return {
    id: data.id,
    bibleVerse: "",
    verseReference: data.verse_reference,
    status: data.status as Session["status"],
    createdAt: new Date(data.created_at),
    groups: [],
  };
};

export const updateSessionStatus = async (sessionId: string, status: string): Promise<boolean> => {
  const { error } = await supabase
    .from("sessions")
    .update({ status })
    .eq("id", sessionId);

  if (error) {
    console.error("[updateSessionStatus] Failed to update session status:", error.message);
  }
  
  return !error;
};

// Fetch public session info (without owner_id) for participants
export const fetchSessionPublic = async (sessionId: string): Promise<{
  id: string;
  verseReference: string;
  status: string;
  groupSize: number;
  groupingMethod: string;
  createdAt: Date;
  allowLatecomers: boolean;
  icebreakerEnabled: boolean;
} | null> => {
  const { data, error } = await supabase
    .from("sessions_public")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    verseReference: data.verse_reference,
    status: data.status,
    groupSize: data.group_size || 4,
    groupingMethod: data.grouping_method || "random",
    createdAt: new Date(data.created_at),
    allowLatecomers: data.allow_latecomers || false,
    icebreakerEnabled: data.icebreaker_enabled || false,
  };
};

// Update session's allow_latecomers setting
export const updateSessionAllowLatecomers = async (
  sessionId: string,
  allowLatecomers: boolean
): Promise<boolean> => {
  const { error } = await supabase
    .from("sessions")
    .update({ allow_latecomers: allowLatecomers })
    .eq("id", sessionId);

  if (error) {
    console.error("[updateSessionAllowLatecomers] Failed:", error.message);
  }

  return !error;
};

// Update session's icebreaker_enabled setting
export const updateSessionIcebreakerEnabled = async (
  sessionId: string,
  icebreakerEnabled: boolean
): Promise<boolean> => {
  const { error } = await supabase
    .from("sessions")
    .update({ icebreaker_enabled: icebreakerEnabled })
    .eq("id", sessionId);

  if (error) {
    console.error("[updateSessionIcebreakerEnabled] Failed:", error.message);
  }

  return !error;
};

// Find the group number with the fewest members (filtered by location for site isolation)
export const findSmallestGroup = async (sessionId: string, location: string = "On-site"): Promise<number | null> => {
  const { data, error } = await supabase
    .from("participants")
    .select("group_number")
    .eq("session_id", sessionId)
    .eq("location", location)
    .not("group_number", "is", null);

  if (error || !data || data.length === 0) {
    console.log("[findSmallestGroup] No groups found for location:", location);
    return null;
  }

  // Count members per group
  const groupCounts = new Map<number, number>();
  for (const p of data) {
    const gn = p.group_number as number;
    groupCounts.set(gn, (groupCounts.get(gn) || 0) + 1);
  }

  // Find the group with the minimum count
  let minGroup = 1;
  let minCount = Infinity;
  for (const [gn, count] of groupCounts) {
    if (count < minCount) {
      minCount = count;
      minGroup = gn;
    }
  }

  console.log("[findSmallestGroup] Found smallest group:", minGroup, "with", minCount, "members at", location);
  return minGroup;
};

// Assign a latecomer to the smallest group
export const assignLatecomerToGroup = async (
  participantId: string,
  groupNumber: number
): Promise<boolean> => {
  const { error } = await supabase
    .from("participants")
    .update({ group_number: groupNumber, ready_confirmed: false })
    .eq("id", participantId);

  return !error;
};

// Participant functions
export const joinSession = async (
  sessionId: string,
  name: string,
  email: string,
  gender: "male" | "female",
  location: string = "On-site"
): Promise<User | null> => {
  // First check if user already exists using the security definer function
  const { data: existingData } = await supabase
    .rpc("get_participant_for_reentry", {
      p_session_id: sessionId,
      p_email: email,
    });

  if (existingData && existingData.length > 0) {
    const existing = existingData[0];
    return {
      id: existing.id,
      name: existing.name,
      email: email,
      gender: existing.gender as "male" | "female",
      groupNumber: existing.group_number || undefined,
      joinedAt: new Date(existing.joined_at),
      location: existing.location,
      readyConfirmed: existing.ready_confirmed,
    };
  }

  // New user - insert
  const { data, error } = await supabase
    .from("participants")
    .insert({
      session_id: sessionId,
      name,
      email,
      gender,
      location,
    })
    .select()
    .single();

  if (error) {
    console.error("Join session error:", error.code, error.message);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    gender: data.gender as "male" | "female",
    groupNumber: data.group_number || undefined,
    joinedAt: new Date(data.joined_at),
    location: data.location,
    readyConfirmed: data.ready_confirmed,
  };
};

// Fetch participants using the secure view (hides emails from non-owners)
export const fetchParticipantsSecure = async (sessionId: string): Promise<User[]> => {
  const { data, error } = await supabase
    .from("participant_names")
    .select("*")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });

  if (error) {
    return [];
  }

  return data.map((p: { id: string; name: string; email: string | null; gender: string; group_number: number | null; joined_at: string; location: string; ready_confirmed: boolean }) => ({
    id: p.id,
    name: p.name,
    email: p.email || "", // Email is null in the view for privacy
    gender: p.gender as "male" | "female",
    groupNumber: p.group_number || undefined,
    joinedAt: new Date(p.joined_at),
    location: p.location,
    readyConfirmed: p.ready_confirmed,
  }));
};

// Fetch participants with full data (for session owners only)
export const fetchParticipants = async (sessionId: string): Promise<User[]> => {
  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });

  if (error) {
    return [];
  }

  return data.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    gender: p.gender as "male" | "female",
    groupNumber: p.group_number || undefined,
    joinedAt: new Date(p.joined_at),
    location: p.location,
    readyConfirmed: p.ready_confirmed,
  }));
};

// Helper function to shuffle an array
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Helper function to apply gender balancing
const applyGenderBalancing = (users: User[]): User[] => {
  const males = users.filter((u) => u.gender === "male");
  const females = users.filter((u) => u.gender === "female");
  const balanced: User[] = [];
  const maxLen = Math.max(males.length, females.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < males.length) balanced.push(males[i]);
    if (i < females.length) balanced.push(females[i]);
  }
  return balanced;
};

/**
 * Calculate optimal group sizes: prioritize minSize, expand to maxSize only when needed
 * 
 * Example: 13 people with min=4, max=6
 * - 13 / 4 = 3 groups with remainder 1
 * - Distribute remainder: 3 groups of 4, plus 1 extra = [5, 4, 4] (13 total)
 */
const calculateOptimalGroupSizes = (total: number, minSize: number, maxSize: number): number[] => {
  // Calculate how many groups at minSize, and what's left over
  const groupsAtMin = Math.floor(total / minSize);
  const remainder = total % minSize;
  
  if (remainder === 0) {
    // Perfect fit at minSize
    return Array(groupsAtMin).fill(minSize);
  }
  
  // We have a remainder. Options:
  // 1. Distribute remainder across existing groups (if they can absorb it)
  // 2. Create one more smaller group (if it meets minSize)
  
  const canAbsorb = groupsAtMin * (maxSize - minSize) >= remainder;
  
  if (canAbsorb && groupsAtMin > 0) {
    // Distribute remainder across groups, starting from the first
    const sizes = Array(groupsAtMin).fill(minSize);
    for (let i = 0; i < remainder; i++) {
      sizes[i % groupsAtMin]++;
    }
    return sizes;
  } else if (remainder >= minSize) {
    // Remainder is large enough to be its own group
    return [...Array(groupsAtMin).fill(minSize), remainder];
  } else if (groupsAtMin > 0) {
    // Remainder too small - redistribute all users evenly
    const newTotal = total;
    const newGroupCount = groupsAtMin;
    const baseSize = Math.floor(newTotal / newGroupCount);
    const extra = newTotal % newGroupCount;
    const sizes: number[] = [];
    for (let i = 0; i < newGroupCount; i++) {
      sizes.push(baseSize + (i < extra ? 1 : 0));
    }
    return sizes;
  } else {
    // Edge case: total < minSize, just return one group
    return [total];
  }
};

/**
 * Helper function to process a gender group (males or females only)
 */
const processGenderGroup = (
  usersToGroup: User[],
  minSize: number,
  maxSize: number,
  startGroupNumber: number,
  groups: Group[],
  groupAssignments: { participantId: string; groupNumber: number }[]
): number => {
  let groupNumber = startGroupNumber;
  const totalUsers = usersToGroup.length;
  
  if (totalUsers <= maxSize) {
    // Single group
    for (const member of usersToGroup) {
      groupAssignments.push({ participantId: member.id, groupNumber });
      member.groupNumber = groupNumber;
    }
    groups.push({
      id: `group-${groupNumber}`,
      number: groupNumber,
      members: usersToGroup,
    });
    return groupNumber + 1;
  }
  
  // Multiple groups needed
  const groupSizes = calculateOptimalGroupSizes(totalUsers, minSize, maxSize);
  
  let currentIndex = 0;
  for (const size of groupSizes) {
    const groupMembers = usersToGroup.slice(currentIndex, currentIndex + size);
    currentIndex += size;
    
    for (const member of groupMembers) {
      groupAssignments.push({ participantId: member.id, groupNumber });
      member.groupNumber = groupNumber;
    }
    
    groups.push({
      id: `group-${groupNumber}`,
      number: groupNumber,
      members: groupMembers,
    });
    groupNumber++;
  }
  
  return groupNumber;
};

/**
 * Optimized grouping algorithm: prioritize minSize, expand to maxSize only when needed
 * 
 * Logic:
 * 1. Calculate how many groups we can form at minSize
 * 2. If there's a remainder, distribute it across groups (up to maxSize)
 * 3. If remainder is too small to form a valid group, merge into existing groups
 */
export const assignGroupsToParticipants = async (
  sessionId: string,
  participants: User[],
  settings: GroupingSettings
): Promise<Group[]> => {
  const { method, minSize, maxSize } = settings;
  
  // Step 1: Bucket participants by location
  const locationBuckets = new Map<string, User[]>();
  for (const p of participants) {
    const loc = p.location || "On-site";
    if (!locationBuckets.has(loc)) {
      locationBuckets.set(loc, []);
    }
    locationBuckets.get(loc)!.push(p);
  }

  const groups: Group[] = [];
  let groupNumber = 1;
  
  // Collect all updates for batch processing
  const groupAssignments: { participantId: string; groupNumber: number }[] = [];

  // Step 2: Process each location bucket independently (in-memory, no DB calls yet)
  for (const [, users] of locationBuckets) {
    // Gender-separated mode: split into male and female groups first
    if (method === "gender-separated") {
      const males = shuffleArray(users.filter(u => u.gender === "male"));
      const females = shuffleArray(users.filter(u => u.gender === "female"));
      
      // Process males
      if (males.length > 0) {
        groupNumber = processGenderGroup(males, minSize, maxSize, groupNumber, groups, groupAssignments);
      }
      
      // Process females
      if (females.length > 0) {
        groupNumber = processGenderGroup(females, minSize, maxSize, groupNumber, groups, groupAssignments);
      }
    } else {
      // Random or gender-balanced
      let usersToGroup = [...users];
      
      if (method === "gender-balanced") {
        usersToGroup = applyGenderBalancing(usersToGroup);
      } else {
        usersToGroup = shuffleArray(usersToGroup);
      }

      const totalUsers = usersToGroup.length;
      
      // Edge case: fewer users than maxSize - put them all in one group
      if (totalUsers <= maxSize) {
        for (const member of usersToGroup) {
          groupAssignments.push({ participantId: member.id, groupNumber });
          member.groupNumber = groupNumber;
        }
        groups.push({
          id: `group-${groupNumber}`,
          number: groupNumber,
          members: usersToGroup,
        });
        groupNumber++;
        continue;
      }

      // Calculate optimal distribution: prioritize minSize, expand only when needed
      const groupSizes = calculateOptimalGroupSizes(totalUsers, minSize, maxSize);
      
      let currentIndex = 0;
      for (const size of groupSizes) {
        const groupMembers = usersToGroup.slice(currentIndex, currentIndex + size);
        currentIndex += size;
        
        for (const member of groupMembers) {
          groupAssignments.push({ participantId: member.id, groupNumber });
          member.groupNumber = groupNumber;
        }
        
        groups.push({
          id: `group-${groupNumber}`,
          number: groupNumber,
          members: groupMembers,
        });
        groupNumber++;
      }
    }
  }

  // Step 4: Batch update all participants by group number (one query per group)
  const groupedAssignments = new Map<number, string[]>();
  for (const { participantId, groupNumber: gn } of groupAssignments) {
    if (!groupedAssignments.has(gn)) {
      groupedAssignments.set(gn, []);
    }
    groupedAssignments.get(gn)!.push(participantId);
  }

  // Execute batch updates in parallel (one request per group, not per participant)
  const updatePromises = Array.from(groupedAssignments.entries()).map(([gn, ids]) =>
    supabase
      .from("participants")
      .update({ group_number: gn, ready_confirmed: false })
      .in("id", ids)
  );
  
  await Promise.all(updatePromises);

  // Update session status to 'grouping' (verification phase)
  await updateSessionStatus(sessionId, "grouping");

  return groups;
};

// Update participant's ready confirmation status using secure RPC
export const updateParticipantReady = async (
  participantId: string,
  ready: boolean,
  sessionId?: string,
  email?: string
): Promise<boolean> => {
  // If session and email provided, use the secure RPC function
  if (sessionId && email) {
    const { data, error } = await supabase.rpc("set_participant_ready", {
      p_session_id: sessionId,
      p_participant_id: participantId,
      p_email: email,
      p_ready: ready,
    });

    if (error) {
      console.error("[updateParticipantReady] RPC error:", error);
      return false;
    }

    return data === true;
  }

  // Fallback to direct update (for admin use)
  const { error } = await supabase
    .from("participants")
    .update({ ready_confirmed: ready })
    .eq("id", participantId);
  
  return !error;
};

// Fetch group members for verification
export const fetchGroupMembers = async (
  sessionId: string,
  groupNumber: number
): Promise<User[]> => {
  const { data, error } = await supabase
    .from("participant_names")
    .select("*")
    .eq("session_id", sessionId)
    .eq("group_number", groupNumber)
    .order("joined_at", { ascending: true });

  if (error) {
    return [];
  }

  return data.map((p: { id: string; name: string; email: string | null; gender: string; group_number: number | null; joined_at: string; location: string; ready_confirmed: boolean }) => ({
    id: p.id,
    name: p.name,
    email: p.email || "",
    gender: p.gender as "male" | "female",
    groupNumber: p.group_number || undefined,
    joinedAt: new Date(p.joined_at),
    location: p.location,
    readyConfirmed: p.ready_confirmed,
  }));
};

// Submission functions
export const submitStudyNotes = async (
  submission: Omit<StudySubmission, "id" | "submittedAt">
): Promise<StudySubmission | null> => {
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      session_id: submission.sessionId,
      participant_id: submission.userId,
      group_number: submission.groupNumber,
      name: submission.name,
      email: submission.email,
      bible_verse: submission.bibleVerse,
      theme: submission.theme,
      moving_verse: submission.movingVerse,
      facts_discovered: submission.factsDiscovered,
      traditional_exegesis: submission.traditionalExegesis,
      inspiration_from_god: submission.inspirationFromGod,
      application_in_life: submission.applicationInLife,
      others: submission.others,
    })
    .select()
    .single();

  if (error) {
    return null;
  }

  return {
    id: data.id,
    sessionId: data.session_id,
    userId: data.participant_id,
    groupNumber: data.group_number,
    name: data.name,
    email: data.email,
    bibleVerse: data.bible_verse,
    theme: data.theme || "",
    movingVerse: data.moving_verse || "",
    factsDiscovered: data.facts_discovered || "",
    traditionalExegesis: data.traditional_exegesis || "",
    inspirationFromGod: data.inspiration_from_god || "",
    applicationInLife: data.application_in_life || "",
    others: data.others || "",
    submittedAt: new Date(data.submitted_at),
  };
};

// Fetch all submissions for session owners (with email access)
export const fetchSubmissions = async (sessionId: string): Promise<StudySubmission[]> => {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("session_id", sessionId)
    .order("submitted_at", { ascending: true });

  if (error) {
    return [];
  }

  return data.map((s) => ({
    id: s.id,
    sessionId: s.session_id,
    userId: s.participant_id,
    groupNumber: s.group_number,
    name: s.name,
    email: s.email,
    bibleVerse: s.bible_verse,
    theme: s.theme || "",
    movingVerse: s.moving_verse || "",
    factsDiscovered: s.facts_discovered || "",
    traditionalExegesis: s.traditional_exegesis || "",
    inspirationFromGod: s.inspiration_from_god || "",
    applicationInLife: s.application_in_life || "",
    others: s.others || "",
    submittedAt: new Date(s.submitted_at),
  }));
};

// Fetch submissions for participants (without email - uses public view)
export const fetchSubmissionsPublic = async (sessionId: string): Promise<StudySubmission[]> => {
  const { data, error } = await supabase
    .from("submissions_public")
    .select("*")
    .eq("session_id", sessionId)
    .order("submitted_at", { ascending: true });

  if (error) {
    return [];
  }

  return data.map((s) => ({
    id: s.id,
    sessionId: s.session_id,
    userId: s.participant_id,
    groupNumber: s.group_number,
    name: s.name,
    email: "", // Email is hidden from participants
    bibleVerse: s.bible_verse,
    theme: s.theme || "",
    movingVerse: s.moving_verse || "",
    factsDiscovered: s.facts_discovered || "",
    traditionalExegesis: s.traditional_exegesis || "",
    inspirationFromGod: s.inspiration_from_god || "",
    applicationInLife: s.application_in_life || "",
    others: s.others || "",
    submittedAt: new Date(s.submitted_at),
  }));
};

// AI Report functions
export interface AIReportOptions {
  fastMode?: boolean;      // Use faster model for group reports
  filledOnly?: boolean;    // Only analyze entries with content
}

export const generateAIReport = async (
  sessionId: string,
  reportType: "group" | "overall",
  groupNumber?: number,
  options?: AIReportOptions
): Promise<{ success: boolean; report?: string; reportId?: string; error?: string }> => {
  const { data, error } = await supabase.functions.invoke("generate-report", {
    body: { 
      sessionId, 
      reportType, 
      groupNumber,
      fastMode: options?.fastMode ?? false,
      filledOnly: options?.filledOnly ?? false,
    },
  });

  if (error) {
    return { success: false, error: GENERIC_ERROR };
  }

  if (data.error) {
    return { success: false, error: data.error };
  }

  return { success: true, report: data.report, reportId: data.reportId };
};

// Fetch AI reports for a session
export const fetchAIReports = async (
  sessionId: string,
  groupNumber?: number
): Promise<{ id: string; content: string; reportType: string; groupNumber: number | null; createdAt: Date }[]> => {
  let query = supabase
    .from('ai_reports')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  
  if (groupNumber !== undefined) {
    query = query.eq('group_number', groupNumber);
  }
  
  const { data, error } = await query;
  
  if (error || !data) {
    console.error('[fetchAIReports] Error:', error);
    return [];
  }
  
  return data.map(r => ({
    id: r.id,
    content: r.content,
    reportType: r.report_type,
    groupNumber: r.group_number,
    createdAt: new Date(r.created_at),
  }));
};

// Export submissions as CSV
export const exportSubmissionsAsCSV = (submissions: StudySubmission[]): string => {
  const headers = [
    "Group",
    "Name",
    "Email",
    "Bible Verse",
    "Theme",
    "Moving Verse",
    "Facts Discovered",
    "Traditional Exegesis",
    "Inspiration from God",
    "Application in Life",
    "Others",
    "Submitted At",
  ];

  const rows = submissions.map((s) => [
    s.groupNumber,
    s.name,
    s.email,
    s.bibleVerse,
    s.theme,
    s.movingVerse,
    s.factsDiscovered,
    s.traditionalExegesis,
    s.inspirationFromGod,
    s.applicationInLife,
    s.others,
    s.submittedAt.toISOString(),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  return csvContent;
};

// Export study responses as CSV
export const exportStudyResponsesAsCSV = (responses: {
  participantName: string;
  groupNumber: number | null;
  response: {
    title_phrase?: string | null;
    heartbeat_verse?: string | null;
    observation?: string | null;
    core_insight_category?: string | null;
    core_insight_note?: string | null;
    scholars_note?: string | null;
    action_plan?: string | null;
    cool_down_note?: string | null;
    created_at?: string | null;
  } | null;
}[]): string => {
  const headers = [
    "Group",
    "Name",
    "Title Phrase",
    "Heartbeat Verse",
    "Observation",
    "Core Insight Category",
    "Core Insight Note",
    "Scholar's Note",
    "Action Plan",
    "Cool Down Note",
    "Created At",
  ];

  const rows = responses
    .filter(r => r.response)
    .map((r) => [
      r.groupNumber || "",
      r.participantName,
      r.response?.title_phrase || "",
      r.response?.heartbeat_verse || "",
      r.response?.observation || "",
      r.response?.core_insight_category || "",
      r.response?.core_insight_note || "",
      r.response?.scholars_note || "",
      r.response?.action_plan || "",
      r.response?.cool_down_note || "",
      r.response?.created_at || "",
    ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  return csvContent;
};
