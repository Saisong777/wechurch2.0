import { getChurchAliases } from './churches';

export interface PastoralAccessFilter {
  userId?: string;
  churchScopes?: string[];
  personalAccess?: PastoralAccessFilter;
  accessLevel: "all" | "assigned" | "group" | "self" | "none";
  userIds?: string[];
  potentialMemberIds?: string[];
  memberEmails?: string[];
}

export function appendPastoralAccessCondition(
  conditions: string[],
  params: unknown[],
  personAlias: string,
  access?: PastoralAccessFilter | null,
) {
  if (!access || access.accessLevel === "all") return;

  const clauses: string[] = [];
  const churches = (access.churchScopes ?? []).flatMap(getChurchAliases);
  if (churches.length) {
    params.push(churches);
    clauses.push(`${personAlias}.church = ANY($${params.length}::text[])`);
  }
  const userIds = (access.userIds ?? []).filter(Boolean);
  const potentialMemberIds = (access.potentialMemberIds ?? []).filter(Boolean);
  const memberEmails = (access.memberEmails ?? [])
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (userIds.length > 0) {
    params.push(userIds);
    clauses.push(`EXISTS (
      SELECT 1 FROM person_identity_links pal_user
       WHERE pal_user.person_id = ${personAlias}.id
         AND pal_user.user_id = ANY($${params.length}::uuid[])
    )`);
  }

  if (potentialMemberIds.length > 0) {
    params.push(potentialMemberIds);
    clauses.push(`EXISTS (
      SELECT 1 FROM person_identity_links pal_potential
       WHERE pal_potential.person_id = ${personAlias}.id
         AND pal_potential.potential_member_id = ANY($${params.length}::uuid[])
    )`);
  }

  if (memberEmails.length > 0) {
    params.push(memberEmails);
    clauses.push(`(
      lower(${personAlias}.primary_email) = ANY($${params.length}::text[])
      OR EXISTS (
        SELECT 1
          FROM person_identity_links pal_email
          LEFT JOIN users u ON u.id = pal_email.user_id
          LEFT JOIN potential_members pm ON pm.id = pal_email.potential_member_id
         WHERE pal_email.person_id = ${personAlias}.id
           AND lower(COALESCE(u.email, pm.email, '')) = ANY($${params.length}::text[])
      )
    )`);
  }

  conditions.push(clauses.length > 0 ? `(${clauses.join(" OR ")})` : "false");
}
