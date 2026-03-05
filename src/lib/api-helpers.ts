import { Session, User, StudySubmission, GroupingSettings, Group } from "@/types/bible-study";

// Generic error message for client-side display
const GENERIC_ERROR = "An error occurred. Please try again.";

// Session functions
export const createSession = async (verseReference: string): Promise<Session | null> => {
  try {
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verseReference, status: "waiting" }),
    });

    if (!response.ok) return null;
    const data = await response.json();

    return {
      id: data.id,
      bibleVerse: "",
      verseReference: data.verseReference,
      status: data.status as Session["status"],
      createdAt: new Date(data.createdAt),
      groups: [],
    };
  } catch (error) {
    console.error("Create session error:", error);
    return null;
  }
};

export const updateSessionStatus = async (sessionId: string, status: string): Promise<boolean> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      console.error("[updateSessionStatus] Failed to update session status");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("[updateSessionStatus] Error:", error);
    return false;
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
  allowLatecomers: boolean;
  icebreakerEnabled: boolean;
} | null> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`);
    if (!response.ok) return null;
    const data = await response.json();

    return {
      id: data.id,
      verseReference: data.verseReference,
      status: data.status,
      groupSize: data.groupSize || 4,
      groupingMethod: data.groupingMethod || "random",
      createdAt: new Date(data.createdAt),
      allowLatecomers: data.allowLatecomers || false,
      icebreakerEnabled: data.icebreakerEnabled || false,
    };
  } catch (error) {
    console.error("Fetch session public error:", error);
    return null;
  }
};

// Update session's allow_latecomers setting
export const updateSessionAllowLatecomers = async (
  sessionId: string,
  allowLatecomers: boolean
): Promise<boolean> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowLatecomers }),
    });
    return response.ok;
  } catch (error) {
    console.error("Update latecomers error:", error);
    return false;
  }
};

// Update session's icebreaker_enabled setting
export const updateSessionIcebreakerEnabled = async (
  sessionId: string,
  icebreakerEnabled: boolean
): Promise<boolean> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ icebreakerEnabled }),
    });
    return response.ok;
  } catch (error) {
    console.error("Update icebreaker error:", error);
    return false;
  }
};

// Find the group number with the fewest members (filtered by location for site isolation)
export const findSmallestGroup = async (sessionId: string, location: string = "On-site"): Promise<number | null> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/participants`);
    if (!response.ok) return null;
    const participants = await response.json();
    
    const relevant = participants.filter((p: any) => p.location === location && p.groupNumber !== null);
    if (relevant.length === 0) return 1;

    const counts = new Map<number, number>();
    relevant.forEach((p: any) => {
      counts.set(p.groupNumber, (counts.get(p.groupNumber) || 0) + 1);
    });

    let minGroup = 1;
    let minCount = Infinity;
    counts.forEach((count, gn) => {
      if (count < minCount) {
        minCount = count;
        minGroup = gn;
      }
    });

    return minGroup;
  } catch (error) {
    console.error("Find smallest group error:", error);
    return null;
  }
};

// Assign a latecomer to the smallest group
export const assignLatecomerToGroup = async (
  participantId: string,
  groupNumber: number
): Promise<boolean> => {
  try {
    const response = await fetch(`/api/participants/${participantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupNumber, readyConfirmed: false }),
    });
    return response.ok;
  } catch (error) {
    console.error("Assign latecomer error:", error);
    return false;
  }
};

// Participant functions
export const joinSession = async (
  sessionId: string,
  name: string,
  email: string,
  gender: "male" | "female",
  location: string = "On-site"
): Promise<User | null> => {
  try {
    // Check if user already exists
    const response = await fetch(`/api/sessions/${sessionId}/participants`);
    if (response.ok) {
      const participants = await response.json();
      const existing = participants.find((p: any) => p.email === email);
      if (existing) {
        return {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          gender: existing.gender as "male" | "female",
          groupNumber: existing.groupNumber || undefined,
          joinedAt: new Date(existing.joinedAt),
          location: existing.location,
          readyConfirmed: existing.readyConfirmed,
        };
      }
    }

    // New user - insert
    const joinRes = await fetch(`/api/sessions/${sessionId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, gender, location }),
    });

    if (!joinRes.ok) return null;
    const data = await joinRes.json();

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      gender: data.gender as "male" | "female",
      groupNumber: data.groupNumber || undefined,
      joinedAt: new Date(data.joinedAt),
      location: data.location,
      readyConfirmed: data.readyConfirmed,
    };
  } catch (error) {
    console.error("Join session error:", error);
    return null;
  }
};

// Fetch participants using the secure view (hides emails from non-owners)
export const fetchParticipantsSecure = async (sessionId: string): Promise<User[]> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/participants`);
    if (!response.ok) return [];
    const data = await response.json();

    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      email: "", // Hide email for security
      gender: p.gender as "male" | "female",
      groupNumber: p.groupNumber || undefined,
      joinedAt: new Date(p.joinedAt),
      location: p.location,
      readyConfirmed: p.readyConfirmed,
    }));
  } catch (error) {
    console.error("Fetch participants secure error:", error);
    return [];
  }
};

// Fetch participants with full data (for session owners only)
export const fetchParticipants = async (sessionId: string): Promise<User[]> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/participants`);
    if (!response.ok) return [];
    const data = await response.json();

    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      gender: p.gender as "male" | "female",
      groupNumber: p.groupNumber || undefined,
      joinedAt: new Date(p.joinedAt),
      location: p.location,
      readyConfirmed: p.readyConfirmed,
    }));
  } catch (error) {
    console.error("Fetch participants error:", error);
    return [];
  }
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
 */
const calculateOptimalGroupSizes = (total: number, minSize: number, maxSize: number): number[] => {
  const groupsAtMin = Math.floor(total / minSize);
  const remainder = total % minSize;
  
  if (remainder === 0) {
    return Array(groupsAtMin).fill(minSize);
  }
  
  const canAbsorb = groupsAtMin * (maxSize - minSize) >= remainder;
  
  if (canAbsorb && groupsAtMin > 0) {
    const sizes = Array(groupsAtMin).fill(minSize);
    for (let i = 0; i < remainder; i++) {
      sizes[i % groupsAtMin]++;
    }
    return sizes;
  } else if (remainder >= minSize) {
    return [...Array(groupsAtMin).fill(minSize), remainder];
  } else if (groupsAtMin > 0) {
    const baseSize = Math.floor(total / groupsAtMin);
    const extra = total % groupsAtMin;
    const sizes: number[] = [];
    for (let i = 0; i < groupsAtMin; i++) {
      sizes.push(baseSize + (i < extra ? 1 : 0));
    }
    return sizes;
  } else {
    return [total];
  }
};

/**
 * Helper function to process a gender group
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
 * Optimized grouping algorithm
 */
export const assignGroupsToParticipants = async (
  sessionId: string,
  participants: User[],
  settings: GroupingSettings
): Promise<Group[]> => {
  const { method, minSize, maxSize } = settings;
  
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
  const groupAssignments: { participantId: string; groupNumber: number }[] = [];

  for (const [, users] of locationBuckets) {
    if (method === "gender-separated") {
      const males = shuffleArray(users.filter(u => u.gender === "male"));
      const females = shuffleArray(users.filter(u => u.gender === "female"));
      
      if (males.length > 0) {
        groupNumber = processGenderGroup(males, minSize, maxSize, groupNumber, groups, groupAssignments);
      }
      if (females.length > 0) {
        groupNumber = processGenderGroup(females, minSize, maxSize, groupNumber, groups, groupAssignments);
      }
    } else {
      let usersToGroup = [...users];
      if (method === "gender-balanced") {
        usersToGroup = applyGenderBalancing(usersToGroup);
      } else {
        usersToGroup = shuffleArray(usersToGroup);
      }

      const totalUsers = usersToGroup.length;
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

  const groupedAssignments = new Map<number, string[]>();
  for (const { participantId, groupNumber: gn } of groupAssignments) {
    if (!groupedAssignments.has(gn)) {
      groupedAssignments.set(gn, []);
    }
    groupedAssignments.get(gn)!.push(participantId);
  }

  const assignments = Array.from(groupedAssignments.entries()).map(([groupNumber, participantIds]) => ({
    groupNumber,
    participantIds,
  }));

  const response = await fetch('/api/participants/batch-assign-groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ assignments }),
  });

  if (!response.ok) throw new Error('Failed to assign groups');
  await updateSessionStatus(sessionId, "grouping");
  return groups;
};

// Update participant's ready confirmation status using Express API
export const updateParticipantReady = async (
  participantId: string,
  ready: boolean,
  sessionId?: string,
  email?: string
): Promise<boolean> => {
  if (sessionId && email) {
    try {
      const response = await fetch(`/api/participants/${participantId}/set-ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, email, ready }),
      });
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error("[updateParticipantReady] API error:", error);
      return false;
    }
  }

  try {
    const response = await fetch(`/api/participants/${participantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ readyConfirmed: ready }),
    });
    return response.ok;
  } catch (error) {
    console.error("[updateParticipantReady] PATCH error:", error);
    return false;
  }
};

// Fetch group members for verification
export const fetchGroupMembers = async (
  sessionId: string,
  groupNumber: number
): Promise<User[]> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/participants?groupNumber=${groupNumber}`);
    if (!response.ok) return [];
    const data = await response.json();

    return data
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        email: "",
        gender: p.gender as "male" | "female",
        groupNumber: p.groupNumber || undefined,
        joinedAt: new Date(p.joinedAt),
        location: p.location,
        readyConfirmed: p.readyConfirmed,
      }));
  } catch (error) {
    console.error("Fetch group members error:", error);
    return [];
  }
};

// Submission functions
export const submitStudyNotes = async (
  submission: Omit<StudySubmission, "id" | "submittedAt">
): Promise<StudySubmission | null> => {
  try {
    const response = await fetch(`/api/sessions/${submission.sessionId}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return { ...data, submittedAt: new Date(data.submittedAt) };
  } catch (error) {
    console.error("Submit study notes error:", error);
    return null;
  }
};

// Fetch all submissions for session owners
export const fetchSubmissions = async (sessionId: string): Promise<StudySubmission[]> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/submissions`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((s: any) => ({ ...s, submittedAt: new Date(s.submittedAt) }));
  } catch (error) {
    console.error("Fetch submissions error:", error);
    return [];
  }
};

// Fetch submissions for participants
export const fetchSubmissionsPublic = async (sessionId: string): Promise<StudySubmission[]> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/submissions`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((s: any) => ({ ...s, email: "", submittedAt: new Date(s.submittedAt) }));
  } catch (error) {
    console.error("Fetch submissions public error:", error);
    return [];
  }
};

// AI Report functions
export interface AIReportOptions {
  fastMode?: boolean;
  filledOnly?: boolean;
}

export const generateAIReport = async (
  sessionId: string,
  reportType: "group" | "overall",
  groupNumber?: number,
  options?: AIReportOptions,
  _retryCount = 0
): Promise<{ success: boolean; report?: string; reportId?: string; error?: string }> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportType,
        groupNumber,
        fastMode: options?.fastMode ?? false,
        filledOnly: options?.filledOnly ?? false,
      }),
    });
    if (response.status === 429 && _retryCount < 4) {
      const delay = [10000, 20000, 35000, 60000][_retryCount]; // 10s, 20s, 35s, 60s
      console.warn(`[generateAIReport] 429 rate limit, retrying in ${delay}ms (attempt ${_retryCount + 1}/4)`);
      await new Promise(r => setTimeout(r, delay));
      return generateAIReport(sessionId, reportType, groupNumber, options, _retryCount + 1);
    }
    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || "Failed to generate report" };
    }
    const data = await response.json();
    return { success: true, report: data.content, reportId: data.id };
  } catch (error) {
    console.error("Generate report error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

// Fetch AI reports for a session
export const fetchAIReports = async (
  sessionId: string,
  groupNumber?: number
): Promise<{ id: string; content: string; reportType: string; groupNumber: number | null; createdAt: Date }[]> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/reports`);
    if (!response.ok) return [];
    const data = await response.json();
    let reports = data.map((r: any) => ({
      id: r.id,
      content: r.content,
      reportType: r.reportType,
      groupNumber: r.groupNumber,
      createdAt: new Date(r.createdAt),
    }));
    if (groupNumber !== undefined) {
      reports = reports.filter((r: any) => r.groupNumber === groupNumber);
    }
    return reports;
  } catch (error) {
    console.error('[fetchAIReports] Error:', error);
    return [];
  }
};

// Export submissions as CSV
export const exportSubmissionsAsCSV = (submissions: StudySubmission[]): string => {
  const headers = [
    "Group", "Name", "Email", "Bible Verse", "Theme", "Moving Verse",
    "Facts Discovered", "Traditional Exegesis", "Inspiration from God",
    "Application in Life", "Others", "Submitted At",
  ];
  const rows = submissions.map((s) => [
    s.groupNumber, s.name, s.email, s.bibleVerse, s.theme, s.movingVerse,
    s.factsDiscovered, s.traditionalExegesis, s.inspirationFromGod,
    s.applicationInLife, s.others, s.submittedAt.toISOString(),
  ]);
  const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
  return csvContent;
};

// Export study responses as CSV (legacy support)
export const exportStudyResponsesAsCSV = (responses: any[]): string => {
  const headers = ["User ID", "Response", "Created At"];
  const rows = responses.map(r => [r.userId, r.response, r.createdAt]);
  const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
  return csvContent;
};
