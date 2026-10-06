import { churchContext, selectedChurch } from './churchContext';
import { pool } from "./db";
import { getChurchAliases, normalizeChurch } from "./churches";
import { activeGrants } from './accessControl';
import { canComposeEmail } from '../shared/email';
import type { Permission } from '../shared/accessControl';
import { activeGroupAppointments } from './groupAppointments';

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
  personalAccess?: CrmAccessContext;
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
  group_leader: "小家長",
  leader: "小家長",
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

export type CrmCapability = 'personal' | 'care' | 'members' | 'careOrMembers' | 'email' | 'groups';
export async function getCrmAccessContext(userId: string, roleInput?: string | null, capability?: CrmCapability): Promise<CrmAccessContext> {
  const role: CrmRole = isCrmRole(roleInput) ? roleInput : "member";
  let canEnterCrm = isCrmEntryRole(role);
  const canAssignScopes = canAssignCrmScopes(role);

  const currentUserResult = await pool.query(
    "SELECT id, email, church FROM users WHERE id = $1",
    [userId]
  );
  const currentUser = currentUserResult.rows[0];
  const ownChurch = normalizeChurch(currentUser?.church);
  const requestScope=churchContext()?.selectedChurch;
  if(churchContext()&&!requestScope)selectedChurch();

  const churchScopes = new Set<string>();
  const groupIds = new Set<string>();
  const userIds = new Set<string>();
  const potentialMemberIds = new Set<string>();
  const memberEmails = new Set<string>();

  const memberCapability = capability === 'members' || capability === 'email' || capability === 'groups';
  const roleGrant = capability === 'personal' || capability === 'care' || capability === 'careOrMembers' ? role === 'pastor' || role === 'minister' : memberCapability ? role === 'pastor' : true;
  if (roleGrant) {
    if (currentUser?.email) memberEmails.add(String(currentUser.email).trim().toLowerCase());
    userIds.add(userId);
  }

  if (role === "admin") {
    return {
      userId,
      role,
      canEnterCrm,
      accessLevel: "all",
      churchScopes: requestScope ? [requestScope] : ownChurch ? [ownChurch] : [],
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
      accessLevel: "assigned",
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
    `SELECT scope_type, a.church, group_id, member_user_id, potential_member_id,
            can_view_personal, can_manage_care, can_manage_members
       FROM crm_scope_assignments a
      WHERE (a.church=ANY($2::text[]) OR EXISTS(SELECT 1 FROM small_groups g WHERE g.id=a.group_id AND g.church=ANY($2::text[])) OR EXISTS(SELECT 1 FROM users u WHERE u.id=a.member_user_id AND u.church=ANY($2::text[])) OR EXISTS(SELECT 1 FROM potential_members p WHERE p.id=a.potential_member_id AND p.church=ANY($2::text[])))
        AND assignee_user_id = $1
        AND is_active = true
        AND starts_at <= NOW()
        AND (ends_at IS NULL OR ends_at > NOW())`,
    [userId,getChurchAliases(ownChurch)]
  );

  let canViewPersonal = role === "pastor" || role === "minister";
  let canManageCare = role === "pastor" || role === "minister";
  let canManageMembers = role === "pastor";

  for (const assignment of assignmentsResult.rows) {
    // A role's intrinsic appointment capabilities must not widen a separately
    // delegated scope. Each explicit assignment grants only its selected abilities.
    const granted = (capability !== 'email' || canComposeEmail(role)) && (!capability || (capability === 'careOrMembers' ? assignment.can_manage_care || assignment.can_manage_members : assignment[capability === 'personal' ? 'can_view_personal' : capability === 'care' ? 'can_manage_care' : 'can_manage_members']));
    if (!granted) continue;
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

  const appointments = await activeGroupAppointments(userId);
  for (const appointment of appointments) {
    // An appointment supplies management of its group and shared care. It does
    // not supply profile edits, private devotional access or outbound email.
    const appointedCapability = !capability || ['groups','care','careOrMembers'].includes(capability);
    if (!appointedCapability && !roleGrant) continue;
    if (capability === 'email' && !canComposeEmail(role)) continue;
    groupIds.add(appointment.groupId);
    canEnterCrm = true;
    if (appointedCapability) {
      if (capability === 'groups') canManageMembers = true;
      else canManageCare = true;
    }
  }
  const delegated = await activeGrants(userId);
  const required: Permission[] = capability === 'personal' ? [] : capability === 'members' ? ['members.manage']
    : capability === 'groups' ? ['groups.manage'] : capability === 'email' ? ['email.send']
    : capability === 'care' ? ['care.manage'] : capability === 'careOrMembers' ? ['care.manage','members.manage']
    : ['members.read','members.manage','groups.manage','care.manage'];
  for (const grant of delegated) {
    if (!grant.permissions.some(p => required.includes(p))) continue;
    canEnterCrm = true;
    if (grant.scope === 'church') addNormalized(churchScopes, grant.church);
    if (grant.scope === 'group' && grant.groupId) groupIds.add(grant.groupId);
    if (grant.scope === 'member' && grant.memberId) userIds.add(grant.memberId);
    canManageMembers ||= grant.permissions.includes(capability === 'email' ? 'email.send' : capability === 'groups' ? 'groups.manage' : 'members.manage');
    canManageCare ||= grant.permissions.includes('care.manage');
  }
  if (groupIds.size > 0 && (role === "group_leader" || role === "leader")) {
    canManageCare = true;
  }

  if (groupIds.size > 0) {
    const membersResult = await pool.query(
      `SELECT m.user_id,m.potential_member_id,m.member_email FROM small_group_members m
          JOIN small_groups g ON g.id=m.group_id LEFT JOIN users u ON u.id=m.user_id
          LEFT JOIN potential_members p ON p.id=m.potential_member_id
        WHERE m.is_active AND g.is_active AND g.lifecycle IN ('active','paused') AND m.group_id=ANY($1::uuid[])
          AND g.church=ANY($2::text[]) AND (m.user_id IS NULL OR u.church=ANY($2::text[]))
          AND (m.potential_member_id IS NULL OR p.church=ANY($2::text[]))
        UNION SELECT manager.user_id,NULL::uuid,NULL::text FROM small_groups g
          CROSS JOIN LATERAL (VALUES(g.leader_user_id),(g.co_leader_user_id),(g.pastor_user_id)) manager(user_id)
          JOIN users u ON u.id=manager.user_id
          WHERE g.id=ANY($1::uuid[]) AND g.is_active AND g.lifecycle IN ('active','paused')
            AND g.church=ANY($2::text[]) AND u.church=ANY($2::text[])`,
      [[...groupIds],getChurchAliases(ownChurch)]
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
  const requestScope=churchContext()?.selectedChurch;
  if(churchContext())records=records.filter(record=>normalizeChurch(record.church)===requestScope);
  if (access.role === "admin") return records;
  if (access.role === "senior_pastor") {
    return records.filter((record) => churchMatches(access.churchScopes, record.church));
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
  const requestScope=churchContext()?.selectedChurch;
  if(churchContext())records=records.filter(record=>normalizeChurch(record.church)===requestScope);
  if (access.role === "admin") return records;
  if (access.role === "senior_pastor") {
    return records.filter((record) => churchMatches(access.churchScopes, record.church));
  }
  const potentialIds = new Set(access.potentialMemberIds);
  const emails = new Set(access.memberEmails.map((email) => email.toLowerCase()));
  return records.filter((record) => (
    potentialIds.has(record.id) ||
    (record.email ? emails.has(record.email.trim().toLowerCase()) : false) ||
    churchMatches(access.churchScopes, record.church)
  ));
}
