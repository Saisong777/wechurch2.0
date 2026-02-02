/**
 * Force all participants in a session to be marked as ready.
 * This is useful for testing when mock users cannot click checkboxes.
 */
export const forceVerifyAllParticipants = async (sessionId: string): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/force-verify-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || "Failed to force verify" };
    }
    
    const data = await response.json();
    return { success: true, count: data.count || 0 };
  } catch (error) {
    console.error("Force verify error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

/**
 * Fetch participants with their ready status for admin monitoring
 */
export const fetchParticipantsWithReadyStatus = async (sessionId: string): Promise<{
  id: string;
  name: string;
  groupNumber: number | undefined;
  readyConfirmed: boolean;
  location: string;
}[]> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/participants`);
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      groupNumber: p.groupNumber || undefined,
      readyConfirmed: p.readyConfirmed,
      location: p.location,
    }));
  } catch (error) {
    console.error("Fetch participants error:", error);
    return [];
  }
};

/**
 * Calculate ready status for each group
 */
export interface GroupReadyStatus {
  groupNumber: number;
  location: string;
  totalMembers: number;
  readyCount: number;
  allReady: boolean;
  members: { id: string; name: string; readyConfirmed: boolean }[];
}

export const calculateGroupReadyStatus = (
  participants: {
    id: string;
    name: string;
    groupNumber: number | undefined;
    readyConfirmed: boolean;
    location: string;
  }[]
): GroupReadyStatus[] => {
  const groupMap = new Map<number, GroupReadyStatus>();

  for (const p of participants) {
    if (!p.groupNumber) continue;

    if (!groupMap.has(p.groupNumber)) {
      groupMap.set(p.groupNumber, {
        groupNumber: p.groupNumber,
        location: p.location,
        totalMembers: 0,
        readyCount: 0,
        allReady: false,
        members: [],
      });
    }

    const group = groupMap.get(p.groupNumber)!;
    group.totalMembers++;
    if (p.readyConfirmed) {
      group.readyCount++;
    }
    group.members.push({
      id: p.id,
      name: p.name,
      readyConfirmed: p.readyConfirmed,
    });
  }

  for (const group of groupMap.values()) {
    group.allReady = group.readyCount === group.totalMembers && group.totalMembers > 0;
  }

  return Array.from(groupMap.values()).sort((a, b) => a.groupNumber - b.groupNumber);
};

/**
 * Reset all participants' ready_confirmed status to false.
 * Useful when a group needs to re-verify.
 */
export const resetAllReadyStatus = async (sessionId: string): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/reset-ready-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || "Failed to reset ready status" };
    }
    
    const data = await response.json();
    return { success: true, count: data.count || 0 };
  } catch (error) {
    console.error("Reset ready status error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

/**
 * Clear all group assignments (set group_number to null) and reset ready status.
 * Allows admin to re-run grouping from scratch.
 */
export const clearAllGroupAssignments = async (sessionId: string): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/clear-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || "Failed to clear groups" };
    }
    
    const data = await response.json();
    return { success: true, count: data.count || 0 };
  } catch (error) {
    console.error("Clear group assignments error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

/**
 * Re-group only: Clear group assignments and reset ready status, but keep participants.
 * Same as clearAllGroupAssignments but intended for "re-group with new settings" workflow.
 */
export const regroupParticipants = async (sessionId: string): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> => {
  return clearAllGroupAssignments(sessionId);
};

/**
 * End the study session by setting status to 'completed'.
 * This archives the session data for later viewing by admins.
 */
export const endStudySession = async (sessionId: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || "Failed to end session" };
    }
    
    return { success: true };
  } catch (error) {
    console.error("End study session error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};
