import { pool } from "./db";
import { getChurchAliases, normalizeChurch } from "./churches";

export type CrmRole =
  | "admin"
  | "senior_pastor"
  | "pastor"
  | "minister"
  | "group_leader"
  | "leader"
  | "future_leader"
  | "member";

export interface CrmAccessContext {
  userId: string;
  role: CrmRole;
  canEnterCrm: boolean;
  accessLevel: "all" | "assigned" | "group" | "self" | "none";
  churchScopes: string[];
  groupIds: string[];
  userIds: string[];
  potentialMemberIds: string[];
  memberEmails: string[];
  canAssignScopes: boolean;
  canManageMembers: boolean;
  canManageCare: boolean;
  canViewPersonal: boolean;
}

const crmEntryRoles = new Set<CrmRole>([
  "admin",
  "senior_pastor",
  "pastor",
  "minister",
  "group_leader",
  "leader",
  "future_leader",
]);

export const crmRoleLabels: Record<CrmRole, string> = {
  admin: "系統管理員",
  senior_pastor: "主任牧師",
  pastor: "牧師",
  minister: "傳道人",
  group_leader: "小組長",
  leader: "小組長",
  future_leader: "儲備領袖",
  member: "會友",
};

export function isCrmRole(role?: string | null): role is CrmRole {
  return !!role && Object.prototype.hasOwnProperty.call(crmRoleLabels, role);
}

export function isCrmEntryRole(role?: string | null) {
  return isCrmRole(role) && crmEntryRoles.has(role);
}

export function canAssignCrmScopes(role?: string | null) {
  return role === "admin" || role === "senior_pastor";
}

const addNormalized = (set: Set<string>, value?: string | null) => {
  const normalized = normalizeChurch(value);
  if (normalized) set.add(normalized);
};

export async function getCrmAccessContext(userId: string, roleInput?: string | null): Promise<CrmAccessContext> {
  const role: CrmRole = isCrmRole(roleInput) ? roleInput : "member";
  const canEnterCrm = isCrmEntryRole(role);
  const canAssignScopes = canAssignCrmScopes(role);

  const currentUserResult = await pool.query(
    "SELECT id, email, church FROM users WHERE id = $1",
    [userId]
  );
  const currentUser = currentUserResult.rows[0];
  const ownChurch = normalizeChurch(currentUser?.church);

  const churchScopes = new Set<string>();
  const groupIds = new Set<string>();
  const userIds = new Set<string>();
  const potentialMemberIds = new Set<string>();
  const memberEmails = new Set<string>();

  if (currentUser?.email) memberEmails.add(String(currentUser.email).trim().toLowerCase());
  userIds.add(userId);

  if (role === "admin") {
    return {
      userId,
      role,
      canEnterCrm,
      accessLevel: "all",
      churchScopes: [],
      groupIds: [],
      userIds: [],
      potentialMemberIds: [],
      memberEmails: [],
      canAssignScopes,
      canManageMembers: true,
      canManageCare: true,
      canViewPersonal: true,
    };
  }

  if (role === "senior_pastor") {
    if (ownChurch) churchScopes.add(ownChurch);
    return {
      userId,
      role,
      canEnterCrm,
      accessLevel: "all",
      churchScopes: [...churchScopes],
      groupIds: [],
      userIds: [],
      potentialMemberIds: [],
      memberEmails: [],
      canAssignScopes,
      canManageMembers: true,
      canManageCare: true,
      canViewPersonal: true,
    };
  }

  const assignmentsResult = await pool.query(
    `SELECT scope_type, church, group_id, member_user_id, potential_member_id,
            can_view_personal, can_manage_care, can_manage_members
       FROM crm_scope_assignments
      WHERE assignee_user_id = $1
        AND is_active = true
        AND starts_at <= NOW()
        AND (ends_at IS NULL OR ends_at > NOW())`,
    [userId]
  );

  let canViewPersonal = role === "pastor" || role === "minister";
  let canManageCare = role === "pastor" || role === "minister";
  let canManageMembers = role === "pastor";

  for (const assignment of assignmentsResult.rows) {
    if (assignment.scope_type === "church") addNormalized(churchScopes, assignment.church);
    if (assignment.scope_type === "group" && assignment.group_id) groupIds.add(assignment.group_id);
    if (assignment.scope_type === "member" && assignment.member_user_id) userIds.add(assignment.member_user_id);
    if (assignment.scope_type === "member" && assignment.potential_member_id) {
      potentialMemberIds.add(assignment.potential_member_id);
    }
    canViewPersonal = canViewPersonal || assignment.can_view_personal;
    canManageCare = canManageCare || assignment.can_manage_care;
    canManageMembers = canManageMembers || assignment.can_manage_members;
  }

  const ownedGroupsResult = await pool.query(
    `SELECT id, church
       FROM small_groups
      WHERE is_active = true
        AND (leader_user_id = $1 OR pastor_user_id = $1)`,
    [userId]
  );
  for (const group of ownedGroupsResult.rows) {
    groupIds.add(group.id);
    addNormalized(churchScopes, group.church);
  }
  if (groupIds.size > 0 && (role === "group_leader" || role === "leader")) {
    canManageCare = true;
  }

  if (groupIds.size > 0) {
    const membersResult = await pool.query(
      `SELECT user_id, potential_member_id, member_email
         FROM small_group_members
        WHERE is_active = true
          AND group_id = ANY($1::uuid[])`,
      [[...groupIds]]
    );
    for (const member of membersResult.rows) {
      if (member.user_id) userIds.add(member.user_id);
      if (member.potential_member_id) potentialMemberIds.add(member.potential_member_id);
      if (member.member_email) memberEmails.add(String(member.member_email).trim().toLowerCase());
    }
  }

  const assignedPotentialResult = potentialMemberIds.size > 0
    ? await pool.query("SELECT email FROM potential_members WHERE id = ANY($1::uuid[])", [[...potentialMemberIds]])
    : { rows: [] as Array<{ email: string }> };
  for (const member of assignedPotentialResult.rows) {
    if (member.email) memberEmails.add(String(member.email).trim().toLowerCase());
  }

  const assignedUsersResult = userIds.size > 0
    ? await pool.query("SELECT email FROM users WHERE id = ANY($1::uuid[])", [[...userIds]])
    : { rows: [] as Array<{ email: string }> };
  for (const user of assignedUsersResult.rows) {
    if (user.email) memberEmails.add(String(user.email).trim().toLowerCase());
  }

  let accessLevel: CrmAccessContext["accessLevel"] = "none";
  if (churchScopes.size > 0 || groupIds.size > 0 || userIds.size > 1 || potentialMemberIds.size > 0) {
    accessLevel = groupIds.size > 0 && churchScopes.size === 0 ? "group" : "assigned";
  } else if (role === "member") {
    accessLevel = "self";
  } else if (role === "group_leader" || role === "leader") {
    accessLevel = "group";
  } else if (role === "pastor" || role === "minister" || role === "future_leader") {
    accessLevel = "assigned";
  }

  return {
    userId,
    role,
    canEnterCrm,
    accessLevel,
    churchScopes: [...churchScopes],
    groupIds: [...groupIds],
    userIds: [...userIds],
    potentialMemberIds: [...potentialMemberIds],
    memberEmails: [...memberEmails],
    canAssignScopes,
    canManageMembers,
    canManageCare,
    canViewPersonal,
  };
}

function churchMatches(churchScopes: string[], church?: string | null) {
  if (churchScopes.length === 0) return false;
  const normalized = normalizeChurch(church);
  if (!normalized) return false;
  return churchScopes.some((scope) => getChurchAliases(scope).includes(normalized) || scope === normalized);
}

export function filterUsersForCrmAccess<T extends { id: string; email?: string | null; church?: string | null }>(
  records: T[],
  access: CrmAccessContext
) {
  if (access.role === "admin") return records;
  if (access.role === "senior_pastor") {
    return access.churchScopes.length === 0
      ? records
      : records.filter((record) => churchMatches(access.churchScopes, record.church));
  }
  const userIds = new Set(access.userIds);
  const emails = new Set(access.memberEmails.map((email) => email.toLowerCase()));
  return records.filter((record) => (
    userIds.has(record.id) ||
    (record.email ? emails.has(record.email.trim().toLowerCase()) : false) ||
    churchMatches(access.churchScopes, record.church)
  ));
}

export function filterPotentialMembersForCrmAccess<T extends { id: string; email?: string | null; church?: string | null }>(
  records: T[],
  access: CrmAccessContext
) {
  if (access.role === "admin") return records;
  if (access.role === "senior_pastor") {
    return access.churchScopes.length === 0
      ? records
      : records.filter((record) => churchMatches(access.churchScopes, record.church));
  }
  const potentialIds = new Set(access.potentialMemberIds);
  const emails = new Set(access.memberEmails.map((email) => email.toLowerCase()));
  return records.filter((record) => (
    potentialIds.has(record.id) ||
    (record.email ? emails.has(record.email.trim().toLowerCase()) : false) ||
    churchMatches(access.churchScopes, record.church)
  ));
}
