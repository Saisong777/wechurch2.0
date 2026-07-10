import { getChurchAliases, UNASSIGNED_CHURCH_ID, normalizeChurch } from "./churches";
import { pool } from "./db";

function appendChurchCondition(
  conditions: string[],
  params: unknown[],
  columnExpression: string,
  churchScope?: string | null,
) {
  if (!churchScope) return;

  if (churchScope === UNASSIGNED_CHURCH_ID) {
    conditions.push(`(${columnExpression} IS NULL OR trim(${columnExpression}) = '')`);
    return;
  }

  const aliases = getChurchAliases(churchScope);
  params.push(aliases);
  conditions.push(`${columnExpression} = ANY($${params.length}::text[])`);
}

export function isServingSchemaMissingError(error: unknown) {
  const maybeError = error as { code?: string };
  return maybeError?.code === "42P01" || maybeError?.code === "42703";
}

export interface ServingTeamSummary {
  id: string;
  church: string | null;
  name: string;
  category: string;
  description: string | null;
  leaderUserId: string | null;
  leaderName: string | null;
  defaultLocation: string | null;
  defaultStartTime: string | null;
  isActive: boolean;
  roleCount: number;
  memberCount: number;
  upcomingEventCount: number;
}

export interface ServingRoleSummary {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  requiredCount: number;
  sortOrder: number;
  isActive: boolean;
}

export interface ServingMemberSummary {
  id: string;
  teamId: string;
  personId: string;
  userId: string | null;
  displayName: string;
  primaryEmail: string | null;
  roleLabel: string;
  status: string;
}

export interface ServingAssignmentSummary {
  id: string;
  eventId: string;
  roleId: string;
  roleName: string;
  personId: string;
  userId: string | null;
  displayName: string;
  primaryEmail: string | null;
  status: string;
  note: string | null;
  confirmedAt: string | null;
}

export interface ServingEventSummary {
  id: string;
  teamId: string;
  title: string;
  serviceDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  status: string;
  note: string | null;
  requiredCount: number;
  assignedCount: number;
  confirmedCount: number;
  gapCount: number;
  assignments: ServingAssignmentSummary[];
}

export interface ServingAssignablePerson {
  id: string;
  displayName: string;
  primaryEmail: string | null;
  church: string | null;
  hasUser: boolean;
}

export function summarizeCoverage(requiredCount: number, assignments: Array<{ status: string }>) {
  const assignedCount = assignments.filter((item) => !["declined", "cancelled"].includes(item.status)).length;
  const confirmedCount = assignments.filter((item) => item.status === "confirmed" || item.status === "done").length;
  return {
    requiredCount,
    assignedCount,
    confirmedCount,
    gapCount: Math.max(requiredCount - assignedCount, 0),
  };
}

async function assertTeamVisible(teamId: string, churchScope: string | null) {
  const params: unknown[] = [teamId];
  const conditions = ["id = $1"];
  appendChurchCondition(conditions, params, "church", churchScope);
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM serving_teams WHERE ${conditions.join(" AND ")} LIMIT 1`,
    params,
  );
  return Boolean(result.rows[0]);
}

export async function listServingTeams(churchScope: string | null): Promise<ServingTeamSummary[]> {
  const params: unknown[] = [];
  const conditions = ["t.is_active = true"];
  appendChurchCondition(conditions, params, "t.church", churchScope);

  const result = await pool.query<ServingTeamSummary>(
    `SELECT
        t.id,
        t.church,
        t.name,
        t.category,
        t.description,
        t.leader_user_id AS "leaderUserId",
        u.display_name AS "leaderName",
        t.default_location AS "defaultLocation",
        t.default_start_time AS "defaultStartTime",
        t.is_active AS "isActive",
        COALESCE(r.role_count, 0)::int AS "roleCount",
        COALESCE(m.member_count, 0)::int AS "memberCount",
        COALESCE(e.event_count, 0)::int AS "upcomingEventCount"
       FROM serving_teams t
       LEFT JOIN users u ON u.id = t.leader_user_id
       LEFT JOIN (
         SELECT team_id, COUNT(*)::int AS role_count
           FROM serving_roles
          WHERE is_active = true
          GROUP BY team_id
       ) r ON r.team_id = t.id
       LEFT JOIN (
         SELECT team_id, COUNT(*)::int AS member_count
           FROM serving_team_members
          WHERE status = 'active'
          GROUP BY team_id
       ) m ON m.team_id = t.id
       LEFT JOIN (
         SELECT team_id, COUNT(*)::int AS event_count
           FROM serving_schedule_events
          WHERE service_date >= CURRENT_DATE - INTERVAL '7 days'
            AND status <> 'cancelled'
          GROUP BY team_id
       ) e ON e.team_id = t.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY t.name ASC`,
    params,
  );
  return result.rows;
}

export async function listServingRoles(churchScope: string | null): Promise<ServingRoleSummary[]> {
  const params: unknown[] = [];
  const conditions = ["r.is_active = true", "t.id = r.team_id"];
  appendChurchCondition(conditions, params, "t.church", churchScope);

  const result = await pool.query<ServingRoleSummary>(
    `SELECT
        r.id,
        r.team_id AS "teamId",
        r.name,
        r.description,
        r.required_count AS "requiredCount",
        r.sort_order AS "sortOrder",
        r.is_active AS "isActive"
       FROM serving_roles r, serving_teams t
      WHERE ${conditions.join(" AND ")}
      ORDER BY r.sort_order ASC, r.name ASC`,
    params,
  );
  return result.rows;
}

export async function listServingMembers(churchScope: string | null): Promise<ServingMemberSummary[]> {
  const params: unknown[] = [];
  const conditions = ["m.status = 'active'", "t.id = m.team_id", "p.id = m.person_id"];
  appendChurchCondition(conditions, params, "t.church", churchScope);

  const result = await pool.query<ServingMemberSummary>(
    `SELECT
        m.id,
        m.team_id AS "teamId",
        m.person_id AS "personId",
        m.user_id AS "userId",
        p.display_name AS "displayName",
        p.primary_email AS "primaryEmail",
        m.role_label AS "roleLabel",
        m.status
       FROM serving_team_members m, serving_teams t, persons p
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.display_name ASC`,
    params,
  );
  return result.rows;
}

export async function listAssignableServingPeople(churchScope: string | null): Promise<ServingAssignablePerson[]> {
  const params: unknown[] = [];
  const conditions = ["p.pastoral_status <> 'inactive'"];
  appendChurchCondition(conditions, params, "p.church", churchScope);

  const result = await pool.query<ServingAssignablePerson>(
    `SELECT
        p.id,
        p.display_name AS "displayName",
        p.primary_email AS "primaryEmail",
        p.church,
        EXISTS (
          SELECT 1 FROM person_identity_links l
           WHERE l.person_id = p.id AND l.user_id IS NOT NULL
        ) AS "hasUser"
       FROM persons p
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.display_name ASC
      LIMIT 300`,
    params,
  );
  return result.rows;
}

export async function listServingEvents(churchScope: string | null): Promise<ServingEventSummary[]> {
  const params: unknown[] = [];
  const eventConditions = ["e.status <> 'cancelled'", "t.id = e.team_id", "e.service_date >= CURRENT_DATE - INTERVAL '21 days'"];
  appendChurchCondition(eventConditions, params, "t.church", churchScope);

  const eventsResult = await pool.query<Omit<ServingEventSummary, "assignments">>(
    `WITH role_requirements AS (
        SELECT team_id, SUM(required_count)::int AS required_count
          FROM serving_roles
         WHERE is_active = true
         GROUP BY team_id
      ),
      assignment_counts AS (
        SELECT
          a.event_id,
          COUNT(*) FILTER (WHERE a.status NOT IN ('declined', 'cancelled'))::int AS assigned_count,
          COUNT(*) FILTER (WHERE a.status IN ('confirmed', 'done'))::int AS confirmed_count
        FROM serving_assignments a
        GROUP BY a.event_id
      )
      SELECT
        e.id,
        e.team_id AS "teamId",
        e.title,
        e.service_date::text AS "serviceDate",
        e.start_time AS "startTime",
        e.end_time AS "endTime",
        e.location,
        e.status,
        e.note,
        COALESCE(rr.required_count, 0)::int AS "requiredCount",
        COALESCE(ac.assigned_count, 0)::int AS "assignedCount",
        COALESCE(ac.confirmed_count, 0)::int AS "confirmedCount",
        GREATEST(COALESCE(rr.required_count, 0) - COALESCE(ac.assigned_count, 0), 0)::int AS "gapCount"
       FROM serving_schedule_events e
       JOIN serving_teams t ON ${eventConditions.join(" AND ")}
       LEFT JOIN role_requirements rr ON rr.team_id = e.team_id
       LEFT JOIN assignment_counts ac ON ac.event_id = e.id
      ORDER BY e.service_date ASC, e.start_time ASC NULLS LAST
      LIMIT 120`,
    params,
  );

  const eventIds = eventsResult.rows.map((event) => event.id);
  if (eventIds.length === 0) return [];

  const assignmentsResult = await pool.query<ServingAssignmentSummary>(
    `SELECT
        a.id,
        a.event_id AS "eventId",
        a.role_id AS "roleId",
        r.name AS "roleName",
        a.person_id AS "personId",
        a.user_id AS "userId",
        p.display_name AS "displayName",
        p.primary_email AS "primaryEmail",
        a.status,
        a.note,
        a.confirmed_at::text AS "confirmedAt"
       FROM serving_assignments a
       JOIN serving_roles r ON r.id = a.role_id
       JOIN persons p ON p.id = a.person_id
      WHERE a.event_id = ANY($1::uuid[])
      ORDER BY r.sort_order ASC, r.name ASC, p.display_name ASC`,
    [eventIds],
  );

  const assignmentsByEvent = new Map<string, ServingAssignmentSummary[]>();
  for (const assignment of assignmentsResult.rows) {
    const list = assignmentsByEvent.get(assignment.eventId) ?? [];
    list.push(assignment);
    assignmentsByEvent.set(assignment.eventId, list);
  }

  return eventsResult.rows.map((event) => ({
    ...event,
    assignments: assignmentsByEvent.get(event.id) ?? [],
  }));
}

export async function getServingScheduleOverview(churchScope: string | null) {
  const [teams, roles, members, events, people] = await Promise.all([
    listServingTeams(churchScope),
    listServingRoles(churchScope),
    listServingMembers(churchScope),
    listServingEvents(churchScope),
    listAssignableServingPeople(churchScope),
  ]);

  return { teams, roles, members, events, people };
}

export async function createServingTeam(input: {
  church: string | null;
  name: string;
  category?: string;
  description?: string | null;
  leaderUserId?: string | null;
  defaultLocation?: string | null;
  defaultStartTime?: string | null;
}) {
  const result = await pool.query<ServingTeamSummary>(
    `INSERT INTO serving_teams (
        church, name, category, description, leader_user_id, default_location, default_start_time,
        is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5::uuid, $6, $7, true, NOW(), NOW())
      RETURNING
        id,
        church,
        name,
        category,
        description,
        leader_user_id AS "leaderUserId",
        NULL::text AS "leaderName",
        default_location AS "defaultLocation",
        default_start_time AS "defaultStartTime",
        is_active AS "isActive",
        0::int AS "roleCount",
        0::int AS "memberCount",
        0::int AS "upcomingEventCount"`,
    [
      normalizeChurch(input.church),
      input.name,
      input.category || "service",
      input.description ?? null,
      input.leaderUserId ?? null,
      input.defaultLocation ?? null,
      input.defaultStartTime ?? null,
    ],
  );
  return result.rows[0];
}

export async function createServingRole(input: {
  teamId: string;
  name: string;
  description?: string | null;
  requiredCount?: number;
  sortOrder?: number;
}, churchScope: string | null) {
  if (!(await assertTeamVisible(input.teamId, churchScope))) return null;
  const result = await pool.query<ServingRoleSummary>(
    `INSERT INTO serving_roles (
        team_id, name, description, required_count, sort_order, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
      ON CONFLICT (team_id, name) DO UPDATE
        SET description = EXCLUDED.description,
            required_count = EXCLUDED.required_count,
            sort_order = EXCLUDED.sort_order,
            is_active = true,
            updated_at = NOW()
      RETURNING
        id,
        team_id AS "teamId",
        name,
        description,
        required_count AS "requiredCount",
        sort_order AS "sortOrder",
        is_active AS "isActive"`,
    [input.teamId, input.name, input.description ?? null, input.requiredCount ?? 1, input.sortOrder ?? 0],
  );
  return result.rows[0];
}

export async function createServingTeamMember(input: {
  teamId: string;
  personId: string;
  roleLabel?: string;
  note?: string | null;
}, churchScope: string | null) {
  if (!(await assertTeamVisible(input.teamId, churchScope))) return null;
  const person = await pool.query<{ id: string; user_id: string | null }>(
    `SELECT p.id, l.user_id
       FROM persons p
       LEFT JOIN person_identity_links l ON l.person_id = p.id AND l.user_id IS NOT NULL
      WHERE p.id = $1
      LIMIT 1`,
    [input.personId],
  );
  if (!person.rows[0]) return null;

  const result = await pool.query(
    `INSERT INTO serving_team_members (
        team_id, person_id, user_id, role_label, status, note, joined_at, created_at, updated_at
      )
      VALUES ($1, $2, $3::uuid, $4, 'active', $5, NOW(), NOW(), NOW())
      ON CONFLICT (team_id, person_id) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            role_label = EXCLUDED.role_label,
            status = 'active',
            note = EXCLUDED.note,
            updated_at = NOW()
      RETURNING *`,
    [input.teamId, input.personId, person.rows[0].user_id, input.roleLabel || "同工", input.note ?? null],
  );
  return result.rows[0];
}

export async function createServingEvent(input: {
  teamId: string;
  title: string;
  serviceDate: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  note?: string | null;
  createdByUserId?: string | null;
}, churchScope: string | null) {
  if (!(await assertTeamVisible(input.teamId, churchScope))) return null;
  const result = await pool.query<ServingEventSummary>(
    `INSERT INTO serving_schedule_events (
        team_id, title, service_date, start_time, end_time, location, status, note,
        created_by_user_id, created_at, updated_at
      )
      VALUES ($1, $2, $3::date, $4, $5, $6, 'draft', $7, $8::uuid, NOW(), NOW())
      RETURNING
        id,
        team_id AS "teamId",
        title,
        service_date::text AS "serviceDate",
        start_time AS "startTime",
        end_time AS "endTime",
        location,
        status,
        note,
        0::int AS "requiredCount",
        0::int AS "assignedCount",
        0::int AS "confirmedCount",
        0::int AS "gapCount",
        '[]'::json AS assignments`,
    [
      input.teamId,
      input.title,
      input.serviceDate,
      input.startTime ?? null,
      input.endTime ?? null,
      input.location ?? null,
      input.note ?? null,
      input.createdByUserId ?? null,
    ],
  );
  return result.rows[0];
}

export async function updateServingEventStatus(eventId: string, status: string, churchScope: string | null) {
  const params: unknown[] = [eventId, status];
  const conditions = ["e.id = $1", "t.id = e.team_id"];
  appendChurchCondition(conditions, params, "t.church", churchScope);
  const result = await pool.query(
    `UPDATE serving_schedule_events e
        SET status = $2,
            published_at = CASE WHEN $2 = 'published' THEN COALESCE(e.published_at, NOW()) ELSE e.published_at END,
            updated_at = NOW()
       FROM serving_teams t
      WHERE ${conditions.join(" AND ")}
      RETURNING e.*`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function createServingAssignment(input: {
  eventId: string;
  roleId: string;
  personId: string;
  status?: string;
  note?: string | null;
}, churchScope: string | null) {
  const visible = await pool.query<{ team_id: string }>(
    `SELECT e.team_id
       FROM serving_schedule_events e
      WHERE e.id = $1
      LIMIT 1`,
    [input.eventId],
  );
  if (!visible.rows[0]) return null;
  if (!(await assertTeamVisible(visible.rows[0].team_id, churchScope))) return null;

  const role = await pool.query<{ id: string }>(
    `SELECT id FROM serving_roles WHERE id = $1 AND team_id = $2 LIMIT 1`,
    [input.roleId, visible.rows[0].team_id],
  );
  if (!role.rows[0]) return null;

  const person = await pool.query<{ user_id: string | null }>(
    `SELECT l.user_id
       FROM persons p
       LEFT JOIN person_identity_links l ON l.person_id = p.id AND l.user_id IS NOT NULL
      WHERE p.id = $1
      LIMIT 1`,
    [input.personId],
  );
  if (!person.rows[0]) return null;

  const result = await pool.query(
    `INSERT INTO serving_assignments (
        event_id, role_id, person_id, user_id, status, note, confirmed_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4::uuid, $5, $6,
        CASE WHEN $5 = 'confirmed' THEN NOW() ELSE NULL END,
        NOW(), NOW()
      )
      ON CONFLICT (event_id, role_id, person_id) DO UPDATE
        SET status = EXCLUDED.status,
            note = EXCLUDED.note,
            user_id = EXCLUDED.user_id,
            confirmed_at = CASE
              WHEN EXCLUDED.status = 'confirmed' THEN COALESCE(serving_assignments.confirmed_at, NOW())
              WHEN EXCLUDED.status <> 'confirmed' THEN NULL
              ELSE serving_assignments.confirmed_at
            END,
            updated_at = NOW()
      RETURNING *`,
    [input.eventId, input.roleId, input.personId, person.rows[0].user_id, input.status || "pending", input.note ?? null],
  );
  return result.rows[0];
}

export async function updateServingAssignment(
  assignmentId: string,
  updates: { status?: string; note?: string | null },
  churchScope: string | null,
) {
  const params: unknown[] = [assignmentId, updates.status ?? null, updates.note ?? null];
  const conditions = ["a.id = $1", "e.id = a.event_id", "t.id = e.team_id"];
  appendChurchCondition(conditions, params, "t.church", churchScope);
  const result = await pool.query(
    `UPDATE serving_assignments a
        SET status = COALESCE($2, a.status),
            note = COALESCE($3, a.note),
            confirmed_at = CASE
              WHEN $2 = 'confirmed' THEN COALESCE(a.confirmed_at, NOW())
              WHEN $2 IS NOT NULL AND $2 <> 'confirmed' THEN NULL
              ELSE a.confirmed_at
            END,
            updated_at = NOW()
       FROM serving_schedule_events e, serving_teams t
      WHERE ${conditions.join(" AND ")}
      RETURNING a.*`,
    params,
  );
  return result.rows[0] ?? null;
}

const defaultServingTeams = [
  {
    name: "敬拜團",
    category: "worship",
    description: "主日敬拜、領詩、樂手與投影片配搭。",
    roles: ["主領", "司琴/樂手", "投影片"],
  },
  {
    name: "招待團隊",
    category: "welcome",
    description: "門口接待、座位引導、新朋友歡迎。",
    roles: ["招待", "新朋友接待"],
  },
  {
    name: "影音團隊",
    category: "media",
    description: "音控、直播、攝影與錄影。",
    roles: ["音控", "直播/攝影"],
  },
  {
    name: "兒童主日學",
    category: "kids",
    description: "兒童課程、陪伴與安全照顧。",
    roles: ["主教", "助教"],
  },
];

export async function seedDefaultServingTeams(churchScope: string | null, userId: string | null) {
  const church = churchScope === UNASSIGNED_CHURCH_ID ? null : normalizeChurch(churchScope);
  const created: string[] = [];
  for (const team of defaultServingTeams) {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM serving_teams
        WHERE name = $1
          AND COALESCE(church, '') = COALESCE($2, '')
        LIMIT 1`,
      [team.name, church],
    );
    let teamId = existing.rows[0]?.id;
    if (!teamId) {
      const teamResult = await pool.query<{ id: string }>(
        `INSERT INTO serving_teams (
            church, name, category, description, leader_user_id, default_start_time,
            is_active, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5::uuid, '10:30', true, NOW(), NOW())
          RETURNING id`,
        [church, team.name, team.category, team.description, userId],
      );
      teamId = teamResult.rows[0]?.id;
    }
    if (!teamId) continue;
    created.push(teamId);
    for (const [index, roleName] of team.roles.entries()) {
      await createServingRole({ teamId, name: roleName, requiredCount: 1, sortOrder: index + 1 }, churchScope);
    }
  }
  return { teamCount: created.length };
}
