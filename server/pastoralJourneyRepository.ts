import type { PoolClient } from "pg";
import { getChurchAliases, UNASSIGNED_CHURCH_ID, normalizeChurch } from "./churches";
import { pool } from "./db";
import {
  LOVE_JOURNEY_TEMPLATE_SLUG,
  buildLoveJourneyTemplateSeed,
} from "./loveJourneyTemplate";
import {
  IdentitySeedInput,
  IdentitySourceType,
  buildPersonSeed,
  normalizeIdentityEmail,
  scoreIdentityConfidence,
} from "./pastoralIdentity";

type Queryable = Pick<PoolClient, "query">;

const sourceColumnByType: Record<IdentitySourceType, string> = {
  user: "user_id",
  participant: "participant_id",
  potential_member: "potential_member_id",
  care_contact: "care_contact_id",
};

export interface PastoralPersonSummary {
  id: string;
  displayName: string;
  primaryEmail: string | null;
  church: string | null;
  pastoralStage: string;
  pastoralStatus: string;
  linkCount: number;
  hasUser: boolean;
  hasPotentialMember: boolean;
  hasParticipant: boolean;
  hasCareContact: boolean;
  loveJourneyId: string | null;
  loveJourneyStatus: string | null;
  loveJourneyStartedAt: string | null;
  loveJourneyCompletedAt: string | null;
  completedDays: number;
  totalDays: number;
  needsFollowUpCount: number;
  openTaskCount: number;
}

export interface ReconcileResult {
  sourceCount: number;
  createdPersons: number;
  linkedIdentities: number;
  updatedIdentities: number;
}

export interface PastoralTimelineEvent {
  id: string;
  type: "identity" | "attendance" | "study" | "prayer" | "care" | "journey" | "milestone";
  title: string;
  description: string | null;
  occurredAt: string | null;
  tone: "slate" | "sky" | "emerald" | "amber" | "rose" | "indigo";
  sourceId?: string | null;
}

export interface PastoralTaskSummary {
  id: string;
  personId: string;
  title: string;
  description: string | null;
  status: "open" | "done" | "deferred" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  dueAt: string | null;
  assignedToUserId: string | null;
  createdByUserId: string | null;
  sourceType: string | null;
  sourceId: string | null;
  visibility: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonMergeSuggestion {
  id: string;
  primaryPersonId: string;
  duplicatePersonId: string;
  primaryName: string;
  duplicateName: string;
  primaryEmail: string | null;
  duplicateEmail: string | null;
  reason: string;
  confidence: number;
  status: string;
}

export interface PastoralAccessFilter {
  accessLevel: "all" | "assigned" | "group" | "self" | "none";
  userIds?: string[];
  potentialMemberIds?: string[];
  memberEmails?: string[];
}

export function isPastoralSchemaMissingError(error: unknown) {
  const maybeError = error as { code?: string; message?: string };
  return maybeError?.code === "42P01" || maybeError?.code === "42703";
}

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

function getRows<T>(result: { rows: T[] }) {
  return result.rows;
}

function appendPastoralAccessCondition(
  conditions: string[],
  params: unknown[],
  personAlias: string,
  access?: PastoralAccessFilter | null,
) {
  if (!access || access.accessLevel === "all") return;

  const clauses: string[] = [];
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

export async function listPastoralTasks(personId: string, churchScope: string | null, access?: PastoralAccessFilter | null): Promise<PastoralTaskSummary[]> {
  const params: unknown[] = [personId];
  const conditions = ["pt.person_id = $1", "p.id = pt.person_id"];
  appendChurchCondition(conditions, params, "p.church", churchScope);
  appendPastoralAccessCondition(conditions, params, "p", access);

  const result = await pool.query<PastoralTaskSummary>(
    `SELECT
        pt.id,
        pt.person_id AS "personId",
        pt.title,
        pt.description,
        pt.status,
        pt.priority,
        pt.due_at::text AS "dueAt",
        pt.assigned_to_user_id AS "assignedToUserId",
        pt.created_by_user_id AS "createdByUserId",
        pt.source_type AS "sourceType",
        pt.source_id AS "sourceId",
        pt.visibility,
        pt.completed_at::text AS "completedAt",
        pt.created_at::text AS "createdAt",
        pt.updated_at::text AS "updatedAt"
       FROM pastoral_tasks pt, persons p
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        CASE pt.status WHEN 'open' THEN 1 WHEN 'deferred' THEN 2 WHEN 'done' THEN 3 ELSE 4 END,
        CASE pt.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
        pt.due_at ASC NULLS LAST,
        pt.created_at DESC
      LIMIT 80`,
    params,
  );
  return result.rows;
}

export async function createPastoralTask(input: {
  personId: string;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueAt?: string | null;
  assignedToUserId?: string | null;
  createdByUserId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  visibility?: string;
}, churchScope: string | null, access?: PastoralAccessFilter | null): Promise<PastoralTaskSummary | null> {
  const params: unknown[] = [input.personId];
  const conditions = ["p.id = $1"];
  appendChurchCondition(conditions, params, "p.church", churchScope);
  appendPastoralAccessCondition(conditions, params, "p", access);
  const person = await pool.query<{ id: string }>(
    `SELECT p.id FROM persons p WHERE ${conditions.join(" AND ")} LIMIT 1`,
    params,
  );
  if (!person.rows[0]) return null;

  const result = await pool.query<PastoralTaskSummary>(
    `INSERT INTO pastoral_tasks (
        person_id, title, description, status, priority, due_at,
        assigned_to_user_id, created_by_user_id, source_type, source_id, visibility,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::timestamp, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING
        id,
        person_id AS "personId",
        title,
        description,
        status,
        priority,
        due_at::text AS "dueAt",
        assigned_to_user_id AS "assignedToUserId",
        created_by_user_id AS "createdByUserId",
        source_type AS "sourceType",
        source_id AS "sourceId",
        visibility,
        completed_at::text AS "completedAt",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"`,
    [
      input.personId,
      input.title,
      input.description ?? null,
      input.status || "open",
      input.priority || "normal",
      input.dueAt ?? null,
      input.assignedToUserId ?? null,
      input.createdByUserId ?? null,
      input.sourceType ?? null,
      input.sourceId ?? null,
      input.visibility || "pastoral",
    ],
  );
  return result.rows[0] ?? null;
}

export async function updatePastoralTask(
  taskId: string,
  updates: { status?: string; title?: string; description?: string | null; priority?: string; dueAt?: string | null; assignedToUserId?: string | null },
  churchScope: string | null,
  access?: PastoralAccessFilter | null,
): Promise<PastoralTaskSummary | null> {
  const params: unknown[] = [
    taskId,
    updates.status ?? null,
    updates.title ?? null,
    updates.description ?? null,
    updates.priority ?? null,
    updates.dueAt ?? null,
    updates.assignedToUserId ?? null,
  ];
  const conditions = ["pt.id = $1", "p.id = pt.person_id"];
  appendChurchCondition(conditions, params, "p.church", churchScope);
  appendPastoralAccessCondition(conditions, params, "p", access);

  const result = await pool.query<PastoralTaskSummary>(
    `UPDATE pastoral_tasks pt
        SET status = COALESCE($2, pt.status),
            title = COALESCE($3, pt.title),
            description = COALESCE($4, pt.description),
            priority = COALESCE($5, pt.priority),
            due_at = COALESCE($6::timestamp, pt.due_at),
            assigned_to_user_id = COALESCE($7::uuid, pt.assigned_to_user_id),
            completed_at = CASE
              WHEN $2 = 'done' THEN COALESCE(pt.completed_at, NOW())
              WHEN $2 IS NOT NULL AND $2 <> 'done' THEN NULL
              ELSE pt.completed_at
            END,
            updated_at = NOW()
       FROM persons p
      WHERE ${conditions.join(" AND ")}
      RETURNING
        pt.id,
        pt.person_id AS "personId",
        pt.title,
        pt.description,
        pt.status,
        pt.priority,
        pt.due_at::text AS "dueAt",
        pt.assigned_to_user_id AS "assignedToUserId",
        pt.created_by_user_id AS "createdByUserId",
        pt.source_type AS "sourceType",
        pt.source_id AS "sourceId",
        pt.visibility,
        pt.completed_at::text AS "completedAt",
        pt.created_at::text AS "createdAt",
        pt.updated_at::text AS "updatedAt"`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function createNextStepTaskForPerson(personId: string, userId: string | null, churchScope: string | null, access?: PastoralAccessFilter | null) {
  const detail = await getPastoralPersonDetail(personId, churchScope, { canViewPersonal: true, access });
  if (!detail) return null;
  const days = detail.loveJourney?.progress ?? [];
  const followUpDay = days.find((day: any) => day.needsFollowUp);
  const openDay = days.find((day: any) => day.status !== "completed" && day.status !== "skipped");
  const focusDay = followUpDay ?? openDay;
  const title = !detail.loveJourney
    ? "啟動愛的旅程"
    : followUpDay
      ? `跟進 Day ${followUpDay.dayNumber} ・ ${followUpDay.title}`
      : focusDay
        ? `陪伴 Day ${focusDay.dayNumber} ・ ${focusDay.title}`
        : "確認下一段門訓或服事";
  const description = !detail.loveJourney
    ? "邀請這位牧養對象進入 28 天愛的旅程。"
    : focusDay?.actionPrompt || "安排一次簡短關心，確認近況與下一步。";

  return createPastoralTask({
    personId,
    title,
    description,
    priority: followUpDay ? "high" : "normal",
    dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    assignedToUserId: userId,
    createdByUserId: userId,
    sourceType: followUpDay ? "journey_follow_up" : "journey_next_step",
    sourceId: focusDay?.id ?? detail.loveJourney?.id ?? null,
  }, churchScope, access);
}

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function compactIds(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function shortText(value?: string | null, maxLength = 90) {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function sortTimeline(events: PastoralTimelineEvent[]) {
  return events
    .filter((event) => event.occurredAt)
    .sort((a, b) => {
      const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
      const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 80);
}

async function getIdentitySources(churchScope: string | null, careOwnerUserId: string): Promise<IdentitySeedInput[]> {
  const sources: IdentitySeedInput[] = [];

  const userParams: unknown[] = [];
  const userConditions: string[] = [];
  appendChurchCondition(userConditions, userParams, "church", churchScope);
  const usersResult = await pool.query<{
    id: string;
    email: string;
    display_name: string | null;
    church: string | null;
  }>(
    `SELECT id, email, display_name, church
       FROM users
      ${userConditions.length ? `WHERE ${userConditions.join(" AND ")}` : ""}
      ORDER BY created_at DESC
      LIMIT 1000`,
    userParams,
  );
  for (const row of usersResult.rows) {
    sources.push({
      sourceType: "user",
      sourceId: row.id,
      email: row.email,
      displayName: row.display_name,
      church: normalizeChurch(row.church),
      status: "member",
    });
  }

  const potentialParams: unknown[] = [];
  const potentialConditions: string[] = [];
  appendChurchCondition(potentialConditions, potentialParams, "church", churchScope);
  const potentialResult = await pool.query<{
    id: string;
    email: string;
    name: string;
    church: string | null;
    status: string;
  }>(
    `SELECT id, email, name, church, status
       FROM potential_members
      ${potentialConditions.length ? `WHERE ${potentialConditions.join(" AND ")}` : ""}
      ORDER BY updated_at DESC
      LIMIT 1000`,
    potentialParams,
  );
  for (const row of potentialResult.rows) {
    sources.push({
      sourceType: "potential_member",
      sourceId: row.id,
      email: row.email,
      name: row.name,
      church: normalizeChurch(row.church),
      status: row.status,
    });
  }

  const participantParams: unknown[] = [];
  const participantConditions: string[] = ["p.email IS NOT NULL", "trim(p.email) <> ''"];
  appendChurchCondition(participantConditions, participantParams, "s.church_unit", churchScope);
  const participantsResult = await pool.query<{
    id: string;
    email: string;
    name: string;
    church: string | null;
  }>(
    `SELECT DISTINCT ON (lower(p.email))
            p.id, p.email, p.name, s.church_unit AS church
       FROM participants p
       LEFT JOIN sessions s ON s.id = p.session_id
      WHERE ${participantConditions.join(" AND ")}
      ORDER BY lower(p.email), p.joined_at DESC
      LIMIT 1000`,
    participantParams,
  );
  for (const row of participantsResult.rows) {
    sources.push({
      sourceType: "participant",
      sourceId: row.id,
      email: row.email,
      name: row.name,
      church: normalizeChurch(row.church),
    });
  }

  const careResult = await pool.query<{
    id: string;
    name: string;
    church: string | null;
  }>(
    `SELECT c.id, c.name, u.church
       FROM care_contacts c
       JOIN users u ON u.id = c.user_id
      WHERE c.user_id = $1
        AND c.is_archived = false
      ORDER BY c.updated_at DESC
      LIMIT 500`,
    [careOwnerUserId],
  );
  for (const row of careResult.rows) {
    sources.push({
      sourceType: "care_contact",
      sourceId: row.id,
      name: row.name,
      church: normalizeChurch(row.church),
    });
  }

  return sources;
}

async function upsertIdentitySource(client: Queryable, input: IdentitySeedInput) {
  const sourceColumn = sourceColumnByType[input.sourceType];
  const existingLink = await client.query<{ person_id: string }>(
    `SELECT person_id
       FROM person_identity_links
      WHERE ${sourceColumn} = $1
      LIMIT 1`,
    [input.sourceId],
  );

  const seed = buildPersonSeed(input);
  const confidence = scoreIdentityConfidence(input);

  if (existingLink.rows[0]) {
    await client.query(
      `UPDATE persons
          SET display_name = CASE WHEN display_name = '未命名對象' THEN $2 ELSE display_name END,
              primary_email = COALESCE(primary_email, $3),
              church = COALESCE(church, $4),
              pastoral_stage = CASE WHEN pastoral_stage = 'unknown' THEN $5 ELSE pastoral_stage END,
              updated_at = NOW()
        WHERE id = $1`,
      [
        existingLink.rows[0].person_id,
        seed.displayName,
        seed.primaryEmail,
        seed.church,
        seed.pastoralStage,
      ],
    );
    await client.query(
      `UPDATE person_identity_links
          SET source_label = $2,
              confidence = GREATEST(confidence, $3),
              updated_at = NOW()
        WHERE ${sourceColumn} = $1`,
      [input.sourceId, input.sourceType, confidence],
    );
    return { createdPerson: false, linkedIdentity: false, updatedIdentity: true };
  }

  const primaryEmail = normalizeIdentityEmail(input.email);
  let personId: string | undefined;
  if (primaryEmail) {
    const existingPerson = await client.query<{ id: string }>(
      "SELECT id FROM persons WHERE primary_email = $1 LIMIT 1",
      [primaryEmail],
    );
    personId = existingPerson.rows[0]?.id;
  }

  let createdPerson = false;
  if (!personId) {
    const created = await client.query<{ id: string }>(
      `INSERT INTO persons (
          display_name, primary_email, church, pastoral_stage, pastoral_status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (primary_email) DO UPDATE
          SET display_name = COALESCE(persons.display_name, EXCLUDED.display_name),
              church = COALESCE(persons.church, EXCLUDED.church),
              updated_at = NOW()
        RETURNING id`,
      [seed.displayName, seed.primaryEmail, seed.church, seed.pastoralStage, seed.pastoralStatus],
    );
    personId = created.rows[0].id;
    createdPerson = true;
  }

  await client.query(
    `INSERT INTO person_identity_links (
        person_id, ${sourceColumn}, source_type, source_label, match_method, confidence, is_primary, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (${sourceColumn}) DO UPDATE
        SET person_id = EXCLUDED.person_id,
            source_type = EXCLUDED.source_type,
            source_label = EXCLUDED.source_label,
            match_method = EXCLUDED.match_method,
            confidence = GREATEST(person_identity_links.confidence, EXCLUDED.confidence),
            updated_at = NOW()`,
    [
      personId,
      input.sourceId,
      input.sourceType,
      input.sourceType,
      primaryEmail ? "email" : "source",
      confidence,
      primaryEmail !== null,
    ],
  );

  return { createdPerson, linkedIdentity: true, updatedIdentity: false };
}

export async function reconcilePastoralPersons(options: {
  churchScope: string | null;
  careOwnerUserId: string;
}): Promise<ReconcileResult> {
  const sources = await getIdentitySources(options.churchScope, options.careOwnerUserId);
  const client = await pool.connect();
  const result: ReconcileResult = {
    sourceCount: sources.length,
    createdPersons: 0,
    linkedIdentities: 0,
    updatedIdentities: 0,
  };

  try {
    await client.query("BEGIN");
    for (const source of sources) {
      const action = await upsertIdentitySource(client, source);
      if (action.createdPerson) result.createdPersons += 1;
      if (action.linkedIdentity) result.linkedIdentities += 1;
      if (action.updatedIdentity) result.updatedIdentities += 1;
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureLoveJourneyTemplate(client: Queryable = pool) {
  const seed = buildLoveJourneyTemplateSeed();
  const templateResult = await client.query<{ id: string }>(
    `INSERT INTO journey_templates (
        slug, name, description, category, duration_days, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            duration_days = EXCLUDED.duration_days,
            is_active = EXCLUDED.is_active,
            updated_at = NOW()
      RETURNING id`,
    [
      seed.template.slug,
      seed.template.name,
      seed.template.description,
      seed.template.category,
      seed.template.durationDays,
      seed.template.isActive,
    ],
  );

  const templateId = templateResult.rows[0].id;
  for (const day of seed.days) {
    await client.query(
      `INSERT INTO journey_days (
          template_id, day_number, title, scripture_reference, body_markdown, action_prompt, reflection_prompt, discussion_prompt, milestone_key, metadata, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (template_id, day_number) DO UPDATE
          SET title = EXCLUDED.title,
              scripture_reference = EXCLUDED.scripture_reference,
              body_markdown = EXCLUDED.body_markdown,
              action_prompt = EXCLUDED.action_prompt,
              reflection_prompt = EXCLUDED.reflection_prompt,
              discussion_prompt = EXCLUDED.discussion_prompt,
              milestone_key = EXCLUDED.milestone_key,
              metadata = EXCLUDED.metadata,
              updated_at = NOW()`,
      [
        templateId,
        day.dayNumber,
        day.title,
        day.scriptureReference,
        day.bodyMarkdown,
        day.actionPrompt,
        day.reflectionPrompt,
        day.discussionPrompt,
        day.milestoneKey ?? null,
        day.metadata,
      ],
    );
  }

  return { templateId, seed };
}

export async function getPastoralPersons(
  churchScope: string | null,
  options: { limit?: number; offset?: number; search?: string | null; filter?: string | null; access?: PastoralAccessFilter | null } = {},
): Promise<PastoralPersonSummary[]> {
  const params: unknown[] = [LOVE_JOURNEY_TEMPLATE_SLUG];
  const conditions: string[] = [];
  appendChurchCondition(conditions, params, "p.church", churchScope);
  appendPastoralAccessCondition(conditions, params, "p", options.access);
  const search = options.search?.trim();
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(
      p.display_name ILIKE $${params.length}
      OR p.primary_email ILIKE $${params.length}
      OR p.church ILIKE $${params.length}
      OR p.pastoral_stage ILIKE $${params.length}
    )`);
  }
  const filter = options.filter || "all";
  if (filter === "follow-up") {
    conditions.push(`COALESCE(lp."needsFollowUpCount", 0) > 0`);
  } else if (filter === "active") {
    conditions.push(`llj.id IS NOT NULL AND COALESCE(lp."completedDays", 0) < COALESCE(lp."totalDays", 0)`);
  } else if (filter === "not-started") {
    conditions.push(`llj.id IS NULL`);
  } else if (filter === "completed") {
    conditions.push(`COALESCE(lp."totalDays", 0) > 0 AND COALESCE(lp."completedDays", 0) >= COALESCE(lp."totalDays", 0)`);
  } else if (filter === "tasks") {
    conditions.push(`COALESCE(ts."openTaskCount", 0) > 0`);
  }

  const limit = Math.min(Math.max(options.limit ?? 120, 20), 500);
  const offset = Math.max(options.offset ?? 0, 0);
  params.push(limit, offset);
  const limitPlaceholder = `$${params.length - 1}`;
  const offsetPlaceholder = `$${params.length}`;

  const result = await pool.query<PastoralPersonSummary>(
    `WITH link_summary AS (
        SELECT
          person_id,
          COUNT(*)::int AS "linkCount",
          bool_or(user_id IS NOT NULL) AS "hasUser",
          bool_or(potential_member_id IS NOT NULL) AS "hasPotentialMember",
          bool_or(participant_id IS NOT NULL) AS "hasParticipant",
          bool_or(care_contact_id IS NOT NULL) AS "hasCareContact"
        FROM person_identity_links
        GROUP BY person_id
      ),
      latest_love_journey AS (
        SELECT DISTINCT ON (pj.person_id)
          pj.id,
          pj.person_id,
          pj.status,
          pj.started_at,
          pj.completed_at
        FROM person_journeys pj
        JOIN journey_templates jt ON jt.id = pj.template_id
        WHERE jt.slug = $1
        ORDER BY pj.person_id, pj.started_at DESC
      ),
      love_progress AS (
        SELECT
          jp.person_journey_id,
          COUNT(*)::int AS "totalDays",
          COUNT(*) FILTER (WHERE jp.status = 'completed')::int AS "completedDays",
          COUNT(*) FILTER (WHERE jp.needs_follow_up = true)::int AS "needsFollowUpCount"
        FROM journey_progress jp
        GROUP BY jp.person_journey_id
      ),
      task_summary AS (
        SELECT
          person_id,
          COUNT(*) FILTER (WHERE status IN ('open', 'deferred'))::int AS "openTaskCount"
        FROM pastoral_tasks
        GROUP BY person_id
      )
      SELECT
        p.id,
        p.display_name AS "displayName",
        p.primary_email AS "primaryEmail",
        p.church,
        p.pastoral_stage AS "pastoralStage",
        p.pastoral_status AS "pastoralStatus",
        COALESCE(ls."linkCount", 0) AS "linkCount",
        COALESCE(ls."hasUser", false) AS "hasUser",
        COALESCE(ls."hasPotentialMember", false) AS "hasPotentialMember",
        COALESCE(ls."hasParticipant", false) AS "hasParticipant",
        COALESCE(ls."hasCareContact", false) AS "hasCareContact",
        llj.id::text AS "loveJourneyId",
        llj.status AS "loveJourneyStatus",
        llj.started_at::text AS "loveJourneyStartedAt",
        llj.completed_at::text AS "loveJourneyCompletedAt",
        COALESCE(lp."completedDays", 0) AS "completedDays",
        COALESCE(lp."totalDays", 0) AS "totalDays",
        COALESCE(lp."needsFollowUpCount", 0) AS "needsFollowUpCount",
        COALESCE(ts."openTaskCount", 0) AS "openTaskCount"
      FROM persons p
      LEFT JOIN link_summary ls ON ls.person_id = p.id
      LEFT JOIN latest_love_journey llj ON llj.person_id = p.id
      LEFT JOIN love_progress lp ON lp.person_journey_id = llj.id
      LEFT JOIN task_summary ts ON ts.person_id = p.id
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY
        COALESCE(ts."openTaskCount", 0) DESC,
        COALESCE(lp."needsFollowUpCount", 0) DESC,
        CASE p.pastoral_stage
          WHEN 'friend' THEN 1
          WHEN 'newcomer' THEN 1
          WHEN 'follow' THEN 2
          WHEN 'care' THEN 2
          WHEN 'family' THEN 3
          WHEN 'member' THEN 3
          ELSE 4
        END,
        p.updated_at DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}`,
    params,
  );

  return result.rows;
}

async function getPastoralTimeline(input: {
  person: {
    id: string;
    displayName: string;
    primaryEmail: string | null;
    createdAt: Date | string;
  };
  links: Array<{
    id: string;
    sourceType: string;
    userId: string | null;
    participantId: string | null;
    potentialMemberId: string | null;
    careContactId: string | null;
    createdAt: Date | string;
  }>;
}): Promise<PastoralTimelineEvent[]> {
  const events: PastoralTimelineEvent[] = [
    {
      id: `person:${input.person.id}:created`,
      type: "identity",
      title: "建立牧養主檔",
      description: input.person.primaryEmail,
      occurredAt: toIso(input.person.createdAt),
      tone: "slate",
      sourceId: input.person.id,
    },
    ...input.links.map((link) => ({
      id: `identity:${link.id}`,
      type: "identity" as const,
      title: "連結資料來源",
      description: link.sourceType,
      occurredAt: toIso(link.createdAt),
      tone: "slate" as const,
      sourceId: link.id,
    })),
  ];

  const userIds = compactIds(input.links.map((link) => link.userId));
  const participantIds = compactIds(input.links.map((link) => link.participantId));
  const potentialMemberIds = compactIds(input.links.map((link) => link.potentialMemberId));
  const careContactIds = compactIds(input.links.map((link) => link.careContactId));

  if (potentialMemberIds.length > 0) {
    const potentialRows = getRows(await pool.query<{
      id: string;
      name: string;
      status: string;
      sessions_count: number;
      first_joined_at: Date;
      last_session_at: Date;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, name, status, sessions_count, first_joined_at, last_session_at, created_at, updated_at
         FROM potential_members
        WHERE id = ANY($1::uuid[])`,
      [potentialMemberIds],
    ));

    for (const row of potentialRows) {
      events.push({
        id: `potential:${row.id}:created`,
        type: "identity",
        title: "留下新朋友資料",
        description: `${row.name} ・ ${row.status}`,
        occurredAt: toIso(row.created_at || row.first_joined_at),
        tone: "sky",
        sourceId: row.id,
      });
      events.push({
        id: `potential:${row.id}:last-session`,
        type: "attendance",
        title: "最近出席紀錄",
        description: `累計 ${row.sessions_count ?? 0} 次`,
        occurredAt: toIso(row.last_session_at),
        tone: "sky",
        sourceId: row.id,
      });
      if (row.status === "member" || row.status === "declined") {
        events.push({
          id: `potential:${row.id}:status`,
          type: "identity",
          title: row.status === "member" ? "轉為會友" : "暫停互動",
          description: row.status,
          occurredAt: toIso(row.updated_at),
          tone: row.status === "member" ? "emerald" : "slate",
          sourceId: row.id,
        });
      }
    }
  }

  if (participantIds.length > 0) {
    const participantRows = getRows(await pool.query<{
      id: string;
      name: string;
      group_number: number | null;
      joined_at: Date;
      verse_reference: string | null;
      session_status: string | null;
      short_code: string | null;
    }>(
      `SELECT
          p.id,
          p.name,
          p.group_number,
          p.joined_at,
          s.verse_reference,
          s.status AS session_status,
          s.short_code
         FROM participants p
         LEFT JOIN sessions s ON s.id = p.session_id
        WHERE p.id = ANY($1::uuid[])
        ORDER BY p.joined_at DESC
        LIMIT 50`,
      [participantIds],
    ));

    for (const row of participantRows) {
      events.push({
        id: `participant:${row.id}:joined`,
        type: "attendance",
        title: "參與 SoulGym 查經",
        description: [row.verse_reference, row.group_number ? `第 ${row.group_number} 組` : null].filter(Boolean).join(" ・ ") || row.short_code,
        occurredAt: toIso(row.joined_at),
        tone: "sky",
        sourceId: row.id,
      });
    }

    const studyRows = getRows(await pool.query<{
      id: string;
      title_phrase: string | null;
      heartbeat_verse: string | null;
      action_plan: string | null;
      created_at: Date;
      verse_reference: string | null;
    }>(
      `SELECT
          sr.id,
          sr.title_phrase,
          sr.heartbeat_verse,
          sr.action_plan,
          sr.created_at,
          s.verse_reference
         FROM study_responses sr
         LEFT JOIN sessions s ON s.id = sr.session_id
        WHERE sr.user_id = ANY($1::uuid[])
        ORDER BY sr.created_at DESC
        LIMIT 50`,
      [participantIds],
    ));

    for (const row of studyRows) {
      events.push({
        id: `study:${row.id}`,
        type: "study",
        title: "完成查經回應",
        description: shortText(row.title_phrase || row.heartbeat_verse || row.action_plan || row.verse_reference),
        occurredAt: toIso(row.created_at),
        tone: "indigo",
        sourceId: row.id,
      });
    }
  }

  if (userIds.length > 0) {
    const prayerRows = getRows(await pool.query<{
      id: string;
      content: string;
      category: string;
      is_answered: boolean;
      answered_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id, content, category, is_answered, answered_at, created_at
         FROM prayers
        WHERE user_id = ANY($1::uuid[])
        ORDER BY created_at DESC
        LIMIT 50`,
      [userIds],
    ));

    for (const row of prayerRows) {
      events.push({
        id: `prayer:${row.id}`,
        type: "prayer",
        title: row.is_answered ? "禱告事項已蒙應允" : "新增禱告事項",
        description: shortText(row.content),
        occurredAt: toIso(row.is_answered && row.answered_at ? row.answered_at : row.created_at),
        tone: row.is_answered ? "emerald" : "amber",
        sourceId: row.id,
      });
    }

    const readingRows = getRows(await pool.query<{
      id: string;
      scripture_reference: string;
      reading_date: string;
      completed_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id, scripture_reference, reading_date, completed_at, created_at
         FROM user_reading_progress
        WHERE user_id = ANY($1::uuid[])
          AND is_completed = true
        ORDER BY COALESCE(completed_at, created_at) DESC
        LIMIT 40`,
      [userIds],
    ));

    for (const row of readingRows) {
      events.push({
        id: `reading:${row.id}`,
        type: "study",
        title: "完成讀經進度",
        description: row.scripture_reference,
        occurredAt: toIso(row.completed_at || row.created_at || row.reading_date),
        tone: "indigo",
        sourceId: row.id,
      });
    }
  }

  if (careContactIds.length > 0) {
    const careRows = getRows(await pool.query<{
      id: string;
      name: string;
      need: string;
      next_action: string;
      created_at: Date;
      last_cared_at: Date | null;
    }>(
      `SELECT id, name, need, next_action, created_at, last_cared_at
         FROM care_contacts
        WHERE id = ANY($1::uuid[])
        ORDER BY created_at DESC
        LIMIT 50`,
      [careContactIds],
    ));

    for (const row of careRows) {
      events.push({
        id: `care-contact:${row.id}`,
        type: "care",
        title: "加入關懷名單",
        description: shortText(row.need || row.next_action),
        occurredAt: toIso(row.created_at),
        tone: "rose",
        sourceId: row.id,
      });
      if (row.last_cared_at) {
        events.push({
          id: `care-contact:${row.id}:last-cared`,
          type: "care",
          title: "最近關懷",
          description: shortText(row.next_action || row.need),
          occurredAt: toIso(row.last_cared_at),
          tone: "rose",
          sourceId: row.id,
        });
      }
    }

    const careActionRows = getRows(await pool.query<{
      id: string;
      action_type: string;
      note: string | null;
      created_at: Date;
    }>(
      `SELECT id, action_type, note, created_at
         FROM care_actions
        WHERE contact_id = ANY($1::uuid[])
        ORDER BY created_at DESC
        LIMIT 50`,
      [careContactIds],
    ));

    for (const row of careActionRows) {
      events.push({
        id: `care-action:${row.id}`,
        type: "care",
        title: "關懷紀錄",
        description: shortText([row.action_type, row.note].filter(Boolean).join(" ・ ")),
        occurredAt: toIso(row.created_at),
        tone: "rose",
        sourceId: row.id,
      });
    }
  }

  const journeyRows = getRows(await pool.query<{
    id: string;
    status: string;
    started_at: Date;
    completed_at: Date | null;
    name: string;
  }>(
    `SELECT pj.id, pj.status, pj.started_at, pj.completed_at, jt.name
       FROM person_journeys pj
       JOIN journey_templates jt ON jt.id = pj.template_id
      WHERE pj.person_id = $1
      ORDER BY pj.started_at DESC
      LIMIT 20`,
    [input.person.id],
  ));

  for (const row of journeyRows) {
    events.push({
      id: `journey:${row.id}:started`,
      type: "journey",
      title: "啟動門訓旅程",
      description: row.name,
      occurredAt: toIso(row.started_at),
      tone: "indigo",
      sourceId: row.id,
    });
    if (row.completed_at) {
      events.push({
        id: `journey:${row.id}:completed`,
        type: "journey",
        title: "完成門訓旅程",
        description: row.name,
        occurredAt: toIso(row.completed_at),
        tone: "emerald",
        sourceId: row.id,
      });
    }
  }

  const journeyIds = journeyRows.map((row) => row.id);
  if (journeyIds.length > 0) {
    const progressRows = getRows(await pool.query<{
      id: string;
      day_number: number;
      title: string;
      status: string;
      needs_follow_up: boolean;
      completed_at: Date | null;
      updated_at: Date;
    }>(
      `SELECT jp.id, jp.day_number, jd.title, jp.status, jp.needs_follow_up, jp.completed_at, jp.updated_at
         FROM journey_progress jp
         JOIN journey_days jd ON jd.id = jp.journey_day_id
        WHERE jp.person_journey_id = ANY($1::uuid[])
          AND (jp.status = 'completed' OR jp.needs_follow_up = true)
        ORDER BY COALESCE(jp.completed_at, jp.updated_at) DESC
        LIMIT 80`,
      [journeyIds],
    ));

    for (const row of progressRows) {
      events.push({
        id: `journey-progress:${row.id}:${row.status}`,
        type: "journey",
        title: row.status === "completed" ? `完成 Day ${row.day_number}` : `Day ${row.day_number} 需要跟進`,
        description: row.title,
        occurredAt: toIso(row.completed_at || row.updated_at),
        tone: row.needs_follow_up ? "rose" : "indigo",
        sourceId: row.id,
      });
    }

    const milestoneRows = getRows(await pool.query<{
      id: string;
      title: string;
      status: string;
      scheduled_at: Date | null;
      completed_at: Date | null;
      updated_at: Date;
    }>(
      `SELECT id, title, status, scheduled_at, completed_at, updated_at
         FROM journey_milestones
        WHERE person_journey_id = ANY($1::uuid[])
          AND status IN ('scheduled', 'completed')
        ORDER BY COALESCE(completed_at, scheduled_at, updated_at) DESC
        LIMIT 50`,
      [journeyIds],
    ));

    for (const row of milestoneRows) {
      events.push({
        id: `milestone:${row.id}:${row.status}`,
        type: "milestone",
        title: row.status === "completed" ? "完成牧養里程碑" : "安排牧養里程碑",
        description: row.title,
        occurredAt: toIso(row.completed_at || row.scheduled_at || row.updated_at),
        tone: row.status === "completed" ? "emerald" : "amber",
        sourceId: row.id,
      });
    }
  }

  return sortTimeline(events);
}

export async function getPastoralPersonDetail(
  personId: string,
  churchScope: string | null,
  options: { canViewPersonal?: boolean; access?: PastoralAccessFilter | null } = {},
) {
  const personParams: unknown[] = [personId];
  const personConditions = ["p.id = $1"];
  appendChurchCondition(personConditions, personParams, "p.church", churchScope);
  appendPastoralAccessCondition(personConditions, personParams, "p", options.access);

  const person = getRows(await pool.query(
    `SELECT
        p.id,
        p.display_name AS "displayName",
        p.primary_email AS "primaryEmail",
        p.church,
        p.pastoral_stage AS "pastoralStage",
        p.pastoral_status AS "pastoralStatus",
        p.notes,
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt"
      FROM persons p
      WHERE ${personConditions.join(" AND ")}
      LIMIT 1`,
    personParams,
  ))[0];

  if (!person) return null;

  const links = getRows(await pool.query(
    `SELECT
        id,
        source_type AS "sourceType",
        source_label AS "sourceLabel",
        user_id AS "userId",
        participant_id AS "participantId",
        potential_member_id AS "potentialMemberId",
        care_contact_id AS "careContactId",
        match_method AS "matchMethod",
        confidence,
        is_primary AS "isPrimary",
        created_at AS "createdAt"
      FROM person_identity_links
      WHERE person_id = $1
      ORDER BY is_primary DESC, created_at ASC`,
    [personId],
  ));

  const journey = getRows(await pool.query(
    `SELECT
        pj.id,
        pj.status,
        pj.started_at AS "startedAt",
        pj.completed_at AS "completedAt",
        pj.next_follow_up_at AS "nextFollowUpAt",
        pj.private_note AS "privateNote",
        jt.slug,
        jt.name,
        jt.duration_days AS "durationDays"
      FROM person_journeys pj
      JOIN journey_templates jt ON jt.id = pj.template_id
      WHERE pj.person_id = $1
        AND jt.slug = $2
      ORDER BY pj.started_at DESC
      LIMIT 1`,
    [personId, LOVE_JOURNEY_TEMPLATE_SLUG],
  ))[0] ?? null;

  const progress = journey
    ? getRows(await pool.query(
        `SELECT
            jp.id,
            jd.day_number AS "dayNumber",
            jd.title,
            jd.scripture_reference AS "scriptureReference",
            jd.body_markdown AS "bodyMarkdown",
            jd.action_prompt AS "actionPrompt",
            jd.reflection_prompt AS "reflectionPrompt",
            jd.discussion_prompt AS "discussionPrompt",
            jd.milestone_key AS "milestoneKey",
            jp.status,
            jp.response_text AS "responseText",
            jp.mentor_note AS "mentorNote",
            jp.needs_follow_up AS "needsFollowUp",
            jp.completed_at AS "completedAt"
          FROM journey_progress jp
          JOIN journey_days jd ON jd.id = jp.journey_day_id
          WHERE jp.person_journey_id = $1
          ORDER BY jd.day_number`,
        [journey.id],
      ))
    : [];

  const milestones = journey
    ? getRows(await pool.query(
        `SELECT
            id,
            milestone_key AS "milestoneKey",
            title,
            status,
            scheduled_at AS "scheduledAt",
            completed_at AS "completedAt",
            note
          FROM journey_milestones
          WHERE person_journey_id = $1
          ORDER BY created_at ASC`,
        [journey.id],
      ))
    : [];
  const timeline = await getPastoralTimeline({ person, links });
  const tasks = await listPastoralTasks(personId, churchScope, options.access);
  const canViewPersonal = options.canViewPersonal ?? true;

  return {
    person,
    links,
    loveJourney: journey ? {
      ...journey,
      privateNote: canViewPersonal ? journey.privateNote : null,
      progress: progress.map((day: any) => ({
        ...day,
        mentorNote: canViewPersonal ? day.mentorNote : null,
      })),
      milestones,
    } : null,
    timeline,
    tasks: canViewPersonal ? tasks : tasks.filter((task) => task.visibility !== "private"),
    seed: buildLoveJourneyTemplateSeed(),
  };
}

export async function startLoveJourneyForPerson(personId: string, mentorUserId: string | null, churchScope: string | null, access?: PastoralAccessFilter | null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const personParams: unknown[] = [personId];
    const personConditions = ["p.id = $1"];
    appendChurchCondition(personConditions, personParams, "p.church", churchScope);
    appendPastoralAccessCondition(personConditions, personParams, "p", access);
    const person = await client.query<{ id: string }>(
      `SELECT p.id FROM persons p WHERE ${personConditions.join(" AND ")} LIMIT 1`,
      personParams,
    );
    if (!person.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }

    const { templateId, seed } = await ensureLoveJourneyTemplate(client);
    const existing = await client.query<{ id: string }>(
      `SELECT pj.id
         FROM person_journeys pj
         JOIN journey_templates jt ON jt.id = pj.template_id
        WHERE pj.person_id = $1
          AND jt.slug = $2
          AND pj.status IN ('active', 'paused')
        ORDER BY pj.started_at DESC
        LIMIT 1`,
      [personId, LOVE_JOURNEY_TEMPLATE_SLUG],
    );

    let journeyId = existing.rows[0]?.id;
    if (!journeyId) {
      const createdJourney = await client.query<{ id: string }>(
        `INSERT INTO person_journeys (
            person_id, template_id, mentor_user_id, status, started_at, created_at, updated_at
          )
          VALUES ($1, $2, $3, 'active', NOW(), NOW(), NOW())
          RETURNING id`,
        [personId, templateId, mentorUserId],
      );
      journeyId = createdJourney.rows[0].id;
    }

    await client.query(
      `INSERT INTO journey_progress (
          person_journey_id, journey_day_id, day_number, status, created_at, updated_at
        )
        SELECT $1, id, day_number, 'not_started', NOW(), NOW()
          FROM journey_days
         WHERE template_id = $2
        ON CONFLICT (person_journey_id, journey_day_id) DO NOTHING`,
      [journeyId, templateId],
    );

    const existingMilestones = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM journey_milestones WHERE person_journey_id = $1",
      [journeyId],
    );
    if (Number(existingMilestones.rows[0]?.count || 0) === 0) {
      for (const milestone of seed.milestones) {
        await client.query(
          `INSERT INTO journey_milestones (
              person_journey_id, person_id, milestone_key, title, status, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, 'planned', NOW(), NOW())`,
          [journeyId, personId, milestone.milestoneKey, milestone.title],
        );
      }
    }

    await client.query("COMMIT");
    return journeyId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateJourneyProgress(
  progressId: string,
  updates: {
    status?: string;
    responseText?: string | null;
    mentorNote?: string | null;
    needsFollowUp?: boolean;
  },
  churchScope: string | null,
  access?: PastoralAccessFilter | null,
) {
  const params: unknown[] = [
    progressId,
    updates.status ?? null,
    updates.responseText ?? null,
    updates.mentorNote ?? null,
    typeof updates.needsFollowUp === "boolean" ? updates.needsFollowUp : null,
  ];
  const conditions = ["jp.id = $1"];
  const scopeConditions = ["pj.id = jp.person_journey_id", "p.id = pj.person_id"];
  appendChurchCondition(scopeConditions, params, "p.church", churchScope);
  appendPastoralAccessCondition(scopeConditions, params, "p", access);

  const result = await pool.query(
    `UPDATE journey_progress jp
        SET status = COALESCE($2, jp.status),
            response_text = COALESCE($3, jp.response_text),
            mentor_note = COALESCE($4, jp.mentor_note),
            needs_follow_up = COALESCE($5, jp.needs_follow_up),
            completed_at = CASE
              WHEN $2 = 'completed' THEN COALESCE(jp.completed_at, NOW())
              WHEN $2 IS NOT NULL AND $2 <> 'completed' THEN NULL
              ELSE jp.completed_at
            END,
            updated_at = NOW()
      WHERE ${conditions.join(" AND ")}
        AND EXISTS (
          SELECT 1
            FROM person_journeys pj, persons p
           WHERE ${scopeConditions.join(" AND ")}
        )
      RETURNING *`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function updateJourneyMilestone(
  milestoneId: string,
  updates: {
    status?: string;
    note?: string | null;
    scheduledAt?: string | null;
  },
  churchScope: string | null,
  access?: PastoralAccessFilter | null,
) {
  const params: unknown[] = [
    milestoneId,
    updates.status ?? null,
    updates.note ?? null,
    updates.scheduledAt ?? null,
  ];
  const scopeConditions = ["jm.id = $1", "pj.id = jm.person_journey_id", "p.id = pj.person_id"];
  appendChurchCondition(scopeConditions, params, "p.church", churchScope);
  appendPastoralAccessCondition(scopeConditions, params, "p", access);

  const result = await pool.query(
    `UPDATE journey_milestones jm
        SET status = COALESCE($2, jm.status),
            note = COALESCE($3, jm.note),
            scheduled_at = COALESCE($4::timestamp, jm.scheduled_at),
            completed_at = CASE
              WHEN $2 = 'completed' THEN COALESCE(jm.completed_at, NOW())
              WHEN $2 IS NOT NULL AND $2 <> 'completed' THEN NULL
              ELSE jm.completed_at
            END,
            updated_at = NOW()
       FROM person_journeys pj, persons p
      WHERE ${scopeConditions.join(" AND ")}
      RETURNING jm.*`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function ensurePersonForUser(userId: string) {
  const user = await pool.query<{
    id: string;
    email: string;
    display_name: string | null;
    church: string | null;
  }>(
    `SELECT id, email, display_name, church FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const row = user.rows[0];
  if (!row) return null;

  const existingLink = await pool.query<{ person_id: string }>(
    `SELECT person_id FROM person_identity_links WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  if (existingLink.rows[0]) return existingLink.rows[0].person_id;

  const email = normalizeIdentityEmail(row.email);
  const existingPerson = email
    ? await pool.query<{ id: string }>(`SELECT id FROM persons WHERE primary_email = $1 LIMIT 1`, [email])
    : { rows: [] as Array<{ id: string }> };

  let personId = existingPerson.rows[0]?.id;
  if (!personId) {
    const created = await pool.query<{ id: string }>(
      `INSERT INTO persons (display_name, primary_email, church, pastoral_stage, pastoral_status, created_at, updated_at)
       VALUES ($1, $2, $3, 'member', 'active', NOW(), NOW())
       RETURNING id`,
      [row.display_name || row.email.split("@")[0], email, normalizeChurch(row.church)],
    );
    personId = created.rows[0].id;
  }

  await pool.query(
    `INSERT INTO person_identity_links (
        person_id, user_id, source_type, source_label, match_method, confidence, is_primary, created_at, updated_at
      )
      VALUES ($1, $2, 'user', '會員', 'email', 100, true, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE
        SET person_id = EXCLUDED.person_id,
            updated_at = NOW()`,
    [personId, userId],
  );
  return personId;
}

export async function getSelfLoveJourney(userId: string) {
  const personId = await ensurePersonForUser(userId);
  if (!personId) return null;
  const detail = await getPastoralPersonDetail(personId, null, { canViewPersonal: true });
  if (!detail) return null;
  return {
    ...detail,
    person: {
      ...detail.person,
      notes: null,
    },
    loveJourney: detail.loveJourney
      ? {
          ...detail.loveJourney,
          privateNote: null,
          progress: detail.loveJourney.progress.map((day: any) => ({
            ...day,
            mentorNote: null,
          })),
        }
      : null,
    tasks: detail.tasks.filter((task) => task.visibility !== "private"),
  };
}

export async function startSelfLoveJourney(userId: string) {
  const personId = await ensurePersonForUser(userId);
  if (!personId) return null;
  await startLoveJourneyForPerson(personId, null, null);
  return getSelfLoveJourney(userId);
}

export async function updateSelfJourneyProgress(
  userId: string,
  progressId: string,
  updates: {
    status?: string;
    responseText?: string | null;
  },
) {
  const personId = await ensurePersonForUser(userId);
  if (!personId) return null;

  const result = await pool.query(
    `UPDATE journey_progress jp
        SET status = COALESCE($3, jp.status),
            response_text = COALESCE($4, jp.response_text),
            completed_at = CASE
              WHEN $3 = 'completed' THEN COALESCE(jp.completed_at, NOW())
              WHEN $3 IS NOT NULL AND $3 <> 'completed' THEN NULL
              ELSE jp.completed_at
            END,
            updated_at = NOW()
       FROM person_journeys pj
      WHERE jp.id = $1
        AND pj.id = jp.person_journey_id
        AND pj.person_id = $2
      RETURNING jp.*`,
    [progressId, personId, updates.status ?? null, updates.responseText ?? null],
  );
  return result.rows[0] ?? null;
}

export async function listPersonMergeSuggestions(churchScope: string | null): Promise<PersonMergeSuggestion[]> {
  const params: unknown[] = [];
  const conditions = [
    "a.id < b.id",
    "lower(trim(a.display_name)) = lower(trim(b.display_name))",
    "length(trim(a.display_name)) >= 2",
  ];
  appendChurchCondition(conditions, params, "COALESCE(a.church, b.church)", churchScope);

  const result = await pool.query<PersonMergeSuggestion>(
    `WITH candidates AS (
        SELECT
          a.id AS primary_person_id,
          b.id AS duplicate_person_id,
          a.display_name AS primary_name,
          b.display_name AS duplicate_name,
          a.primary_email AS primary_email,
          b.primary_email AS duplicate_email,
          CASE
            WHEN a.primary_email IS NOT NULL AND b.primary_email IS NOT NULL THEN 75
            ELSE 62
          END AS confidence
        FROM persons a
        JOIN persons b ON ${conditions.join(" AND ")}
      )
      SELECT
        COALESCE(pms.id::text, md5(c.primary_person_id::text || ':' || c.duplicate_person_id::text)) AS id,
        c.primary_person_id::text AS "primaryPersonId",
        c.duplicate_person_id::text AS "duplicatePersonId",
        c.primary_name AS "primaryName",
        c.duplicate_name AS "duplicateName",
        c.primary_email AS "primaryEmail",
        c.duplicate_email AS "duplicateEmail",
        '姓名相同，可能是同一位牧養對象' AS reason,
        c.confidence,
        COALESCE(pms.status, 'pending') AS status
       FROM candidates c
       LEFT JOIN person_merge_suggestions pms
         ON pms.primary_person_id = c.primary_person_id
        AND pms.duplicate_person_id = c.duplicate_person_id
      WHERE COALESCE(pms.status, 'pending') = 'pending'
      ORDER BY c.confidence DESC, c.primary_name ASC
      LIMIT 30`,
    params,
  );
  return result.rows;
}

export async function dismissPersonMergeSuggestion(primaryPersonId: string, duplicatePersonId: string) {
  await pool.query(
    `INSERT INTO person_merge_suggestions (
        primary_person_id, duplicate_person_id, reason, confidence, status, created_at, updated_at
      )
      VALUES ($1, $2, '使用者略過', 0, 'dismissed', NOW(), NOW())
      ON CONFLICT (primary_person_id, duplicate_person_id) DO UPDATE
        SET status = 'dismissed',
            updated_at = NOW()`,
    [primaryPersonId, duplicatePersonId],
  );
  return { success: true };
}

export async function mergePastoralPersons(primaryPersonId: string, duplicatePersonId: string, churchScope: string | null) {
  const params: unknown[] = [[primaryPersonId, duplicatePersonId]];
  const conditions = ["id = ANY($1::uuid[])"];
  appendChurchCondition(conditions, params, "church", churchScope);
  const visible = await pool.query<{ id: string }>(
    `SELECT id FROM persons WHERE ${conditions.join(" AND ")}`,
    params,
  );
  if (visible.rows.length < 2) return null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE person_identity_links SET person_id = $1, updated_at = NOW() WHERE person_id = $2`, [primaryPersonId, duplicatePersonId]);
    await client.query(`UPDATE person_journeys SET person_id = $1, updated_at = NOW() WHERE person_id = $2`, [primaryPersonId, duplicatePersonId]);
    await client.query(`UPDATE journey_milestones SET person_id = $1, updated_at = NOW() WHERE person_id = $2`, [primaryPersonId, duplicatePersonId]);
    await client.query(`UPDATE mentor_assignments SET person_id = $1, updated_at = NOW() WHERE person_id = $2`, [primaryPersonId, duplicatePersonId]);
    await client.query(`UPDATE pastoral_tasks SET person_id = $1, updated_at = NOW() WHERE person_id = $2`, [primaryPersonId, duplicatePersonId]);
    await client.query(
      `UPDATE persons p
          SET notes = concat_ws(E'\n', NULLIF(p.notes, ''), concat('Merged duplicate person ', $2::text, ' at ', NOW()::text)),
              updated_at = NOW()
        WHERE p.id = $1`,
      [primaryPersonId, duplicatePersonId],
    );
    await client.query(`DELETE FROM persons WHERE id = $1`, [duplicatePersonId]);
    await client.query(
      `INSERT INTO person_merge_suggestions (
          primary_person_id, duplicate_person_id, reason, confidence, status, created_at, updated_at
        )
        VALUES ($1, $2, '已合併', 100, 'merged', NOW(), NOW())
        ON CONFLICT (primary_person_id, duplicate_person_id) DO UPDATE
          SET status = 'merged',
              updated_at = NOW()`,
      [primaryPersonId, duplicatePersonId],
    );
    await client.query("COMMIT");
    return { success: true, primaryPersonId, duplicatePersonId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
