import { supabase } from "@/integrations/supabase/client";
import { Session, User, StudySubmission, GroupingSettings, Group } from "@/types/bible-study";

// Session functions
export const createSession = async (verseReference: string): Promise<Session | null> => {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ verse_reference: verseReference, status: "waiting" })
    .select()
    .single();

  if (error) {
    console.error("Error creating session:", error);
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

export const updateSessionStatus = async (sessionId: string, status: string) => {
  const { error } = await supabase
    .from("sessions")
    .update({ status })
    .eq("id", sessionId);

  if (error) {
    console.error("Error updating session:", error);
  }
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

  if (error) {
    console.error("Error fetching session:", error);
    return null;
  }

  if (!data) return null;

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
  gender: "male" | "female"
): Promise<User | null> => {
  const { data, error } = await supabase
    .from("participants")
    .insert({
      session_id: sessionId,
      name,
      email,
      gender,
    })
    .select()
    .single();

  if (error) {
    console.error("Error joining session:", error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    gender: data.gender as "male" | "female",
    groupNumber: data.group_number || undefined,
    joinedAt: new Date(data.joined_at),
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
    console.error("Error fetching participants:", error);
    return [];
  }

  return data.map((p: { id: string; name: string; email: string | null; gender: string; group_number: number | null; joined_at: string }) => ({
    id: p.id,
    name: p.name,
    email: p.email || "", // Email is null in the view for privacy
    gender: p.gender as "male" | "female",
    groupNumber: p.group_number || undefined,
    joinedAt: new Date(p.joined_at),
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
    console.error("Error fetching participants:", error);
    return [];
  }

  return data.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    gender: p.gender as "male" | "female",
    groupNumber: p.group_number || undefined,
    joinedAt: new Date(p.joined_at),
  }));
};

export const assignGroupsToParticipants = async (
  sessionId: string,
  participants: User[],
  settings: GroupingSettings
): Promise<Group[]> => {
  const { groupSize, method } = settings;
  let usersToGroup = [...participants];

  // Shuffle or balance
  if (method === "gender-balanced") {
    const males = usersToGroup.filter((u) => u.gender === "male");
    const females = usersToGroup.filter((u) => u.gender === "female");
    usersToGroup = [];
    const maxLen = Math.max(males.length, females.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < males.length) usersToGroup.push(males[i]);
      if (i < females.length) usersToGroup.push(females[i]);
    }
  } else {
    // Random shuffle
    for (let i = usersToGroup.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [usersToGroup[i], usersToGroup[j]] = [usersToGroup[j], usersToGroup[i]];
    }
  }

  const groups: Group[] = [];
  let groupNumber = 1;

  for (let i = 0; i < usersToGroup.length; i += groupSize) {
    const groupMembers = usersToGroup.slice(i, i + groupSize);
    
    // Update each participant's group number in DB
    for (const member of groupMembers) {
      await supabase
        .from("participants")
        .update({ group_number: groupNumber })
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

  // Update session status
  await updateSessionStatus(sessionId, "studying");

  return groups;
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
    console.error("Error submitting notes:", error);
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
    console.error("Error fetching submissions:", error);
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
    console.error("Error fetching public submissions:", error);
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
    console.error("Error generating report:", error);
    return { success: false, error: error.message };
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
