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
  };
};

// Participant functions
export const joinSession = async (
  sessionId: string,
  name: string,
  email: string,
  gender: "male" | "female",
  location: string = "On-site"
): Promise<User | null> => {
  // First try to insert the new participant
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
    // If insert failed due to unique constraint (user already exists), 
    // try to fetch existing record using the public view
    if (error.code === "23505" || error.message?.includes("duplicate")) {
      const { data: existing } = await supabase
        .from("participant_names")
        .select("*")
        .eq("session_id", sessionId)
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        return {
          id: existing.id!,
          name: existing.name!,
          email: email, // Use the provided email since view may mask it
          gender: existing.gender as "male" | "female",
          groupNumber: existing.group_number || undefined,
          joinedAt: new Date(existing.joined_at!),
          location: existing.location!,
          readyConfirmed: existing.ready_confirmed!,
        };
      }
    }
    // For other errors (RLS violation, etc.), log and return null
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

// Multi-site grouping algorithm with max 6 per group
export const assignGroupsToParticipants = async (
  sessionId: string,
  participants: User[],
  settings: GroupingSettings
): Promise<Group[]> => {
  const { method } = settings;
  const MAX_GROUP_SIZE = 6;
  
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

  // Step 2: Process each location bucket independently
  for (const [location, users] of locationBuckets) {
    let usersToGroup = [...users];
    
    // Apply grouping method
    if (method === "gender-balanced") {
      usersToGroup = applyGenderBalancing(usersToGroup);
    } else {
      usersToGroup = shuffleArray(usersToGroup);
    }

    // Step 3: Split into subgroups with max 6 members
    if (usersToGroup.length <= MAX_GROUP_SIZE) {
      // Single group for this location
      for (const member of usersToGroup) {
        await supabase
          .from("participants")
          .update({ group_number: groupNumber, ready_confirmed: false })
          .eq("id", member.id);
        member.groupNumber = groupNumber;
      }
      groups.push({
        id: `group-${groupNumber}`,
        number: groupNumber,
        members: usersToGroup,
      });
      groupNumber++;
    } else {
      // Split into multiple subgroups
      // Calculate optimal subgroup count to balance sizes
      const subgroupCount = Math.ceil(usersToGroup.length / MAX_GROUP_SIZE);
      const baseSize = Math.floor(usersToGroup.length / subgroupCount);
      const remainder = usersToGroup.length % subgroupCount;
      
      let currentIndex = 0;
      for (let subIdx = 0; subIdx < subgroupCount; subIdx++) {
        // Distribute remainder across first groups
        const thisGroupSize = baseSize + (subIdx < remainder ? 1 : 0);
        const groupMembers = usersToGroup.slice(currentIndex, currentIndex + thisGroupSize);
        currentIndex += thisGroupSize;
        
        for (const member of groupMembers) {
          await supabase
            .from("participants")
            .update({ group_number: groupNumber, ready_confirmed: false })
            .eq("id", member.id);
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

  // Update session status to 'grouping' (verification phase)
  await updateSessionStatus(sessionId, "grouping");

  return groups;
};

// Update participant's ready confirmation status
export const updateParticipantReady = async (
  participantId: string,
  ready: boolean
): Promise<boolean> => {
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
export const generateAIReport = async (
  sessionId: string,
  reportType: "group" | "overall",
  groupNumber?: number
): Promise<{ success: boolean; report?: string; error?: string }> => {
  const { data, error } = await supabase.functions.invoke("generate-report", {
    body: { sessionId, reportType, groupNumber },
  });

  if (error) {
    return { success: false, error: GENERIC_ERROR };
  }

  if (data.error) {
    return { success: false, error: data.error };
  }

  return { success: true, report: data.report };
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
