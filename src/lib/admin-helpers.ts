import { supabase } from "@/integrations/supabase/client";

/**
 * Force all participants in a session to be marked as ready.
 * This is useful for testing when mock users cannot click checkboxes.
 */
export const forceVerifyAllParticipants = async (sessionId: string): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> => {
  const { data, error } = await supabase
    .from("participants")
    .update({ ready_confirmed: true })
    .eq("session_id", sessionId)
    .select("id");

  if (error) {
    console.error("Force verify error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, count: data?.length || 0 };
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
  const { data, error } = await supabase
    .from("participants")
    .select("id, name, group_number, ready_confirmed, location")
    .eq("session_id", sessionId)
    .order("group_number", { ascending: true });

  if (error) {
    return [];
  }

  return data.map((p) => ({
    id: p.id,
    name: p.name,
    groupNumber: p.group_number || undefined,
    readyConfirmed: p.ready_confirmed,
    location: p.location,
  }));
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

  // Calculate allReady for each group
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
  const { data, error } = await supabase
    .from("participants")
    .update({ ready_confirmed: false })
    .eq("session_id", sessionId)
    .select("id");

  if (error) {
    console.error("Reset ready status error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, count: data?.length || 0 };
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
  const { data, error } = await supabase
    .from("participants")
    .update({ group_number: null, ready_confirmed: false })
    .eq("session_id", sessionId)
    .select("id");

  if (error) {
    console.error("Clear group assignments error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, count: data?.length || 0 };
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
  // This is essentially the same as clearAllGroupAssignments
  // but semantically represents the "re-group" action
  const { data, error } = await supabase
    .from("participants")
    .update({ group_number: null, ready_confirmed: false })
    .eq("session_id", sessionId)
    .select("id");

  if (error) {
    console.error("Regroup participants error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, count: data?.length || 0 };
};

/**
 * End the study session by setting status to 'completed'.
 * This archives the session data for later viewing by admins.
 */
export const endStudySession = async (sessionId: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  const { error } = await supabase
    .from("sessions")
    .update({ status: "completed" })
    .eq("id", sessionId);

  if (error) {
    console.error("End study session error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
};
