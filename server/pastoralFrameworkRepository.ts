import { getChurchAliases, UNASSIGNED_CHURCH_ID } from "./churches";
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

export function isPastoralFrameworkSchemaMissingError(error: unknown) {
  const maybeError = error as { code?: string };
  return maybeError?.code === "42P01" || maybeError?.code === "42703";
}

export interface PastoralFrameworkRequirement {
  id: string;
  stageId: string;
  requirementType: string;
  title: string;
  description: string | null;
  targetCount: number;
  sortOrder: number;
}

export interface PastoralFrameworkStageSummary {
  id: string;
  slug: string;
  code: string;
  name: string;
  displayName: string;
  description: string | null;
  sortOrder: number;
  sourceLabel: string | null;
  peopleCount: number;
  requirements: PastoralFrameworkRequirement[];
}

export interface PastoralFrameworkSource {
  label: string;
  detail: string;
  path?: string;
}

export function mapPastoralStageSlug(value?: string | null) {
  const normalized = (value || "").trim().toLowerCase();
  if (["friend", "frame", "newcomer", "visitor", "guest", "unknown", ""].includes(normalized)) return "friend";
  if (["family", "member", "rooted"].includes(normalized)) return "family";
  if (["follow", "follower", "disciple", "care"].includes(normalized)) return "follow";
  if (["firemaker", "leader", "future_leader", "pastor"].includes(normalized)) return "firemaker";
  return normalized;
}

const frameworkSources: PastoralFrameworkSource[] = [
  {
    label: "Google Drive 舊版 iM 牧養架構",
    detail: "ECHO: Encounter / Cultivate / Holistic Growth / Outreach，對應 Friend / Family / Follower / Firemaker。",
  },
  {
    label: "Google Drive 2025 討論版",
    detail: "153 門訓系統：1 條件、5 次參與、3 堂課程，從訪客到家人、門徒、領袖。",
  },
  {
    label: "Voice Memo 2026-05-12",
    detail: "確認排班、場地 booking、心理協談課程與牧養捕手系統需要整合進 App。",
    path: "$HOME/SaiVault/25 - Voice Memo/2026/05/2026-05-12 與同工會議 - 牧養原則與事工協調.md",
  },
  {
    label: "Voice Memo 2026-05-19",
    detail: "We Church App 定位為基督徒生活助理：愛神面板、愛人面板、愛的旅程 28 天、緊急禱告與關懷網。",
    path: "$HOME/SaiVault/25 - Voice Memo/2026/05/2026-05-19 iM Miracle互動展覽籌備會議.md",
  },
  {
    label: "Voice Memo 2026-05-26",
    detail: "新版門徒培育骨幹：Friend → Family → Follow → Firemaker，愛的旅程 28 天進入 App。",
    path: "$HOME/SaiVault/25 - Voice Memo/2026/05/2026-05-26 同工會議 - 事工回顧與策略討論.md",
  },
  {
    label: "Voice Memo 2026-06-02",
    detail: "真實週間場地排程、兒童教室容量壓力、弟兄小家與敬拜夜 booking，校準場地與牧養營運模型。",
    path: "$HOME/SaiVault/25 - Voice Memo/2026/06/2026-06-02 靈修 - 五餅二魚神蹟與信心.md",
  },
];

const defaultFramework = [
  {
    slug: "friend",
    code: "FRIEND",
    name: "訪客",
    displayName: "Friend / 訪客",
    description: "從第一次接觸、被歡迎、被看見，到開始穩定進入教會生活。",
    sortOrder: 1,
    sourceLabel: "Voice Memo 2026-05-26 + Google Drive 2025 討論版",
    metadata: { legacyNames: ["Frame", "Encounter", "iM Friend"], echo: "Encounter 相遇" },
    requirements: [
      ["condition", "穩定主日與小組", "開始穩定參與主日與小組，建立基本關係連結。", 1],
      ["participation", "主日崇拜", "至少參與 5 次主日崇拜。", 5],
      ["participation", "小組聚會", "至少參與 5 次小組。", 5],
      ["participation", "服事團隊體驗", "至少參與或體驗 1 次服事團隊。", 1],
      ["participation", "一對一關懷", "與小組長、牧者或陪伴者有 1 次關懷談話。", 1],
      ["participation", "歡迎 / 家人課程", "完成一次歡迎或家人導覽。", 1],
      ["course", "信仰 ABC: 認識神的愛", "建立福音與天父之愛的起點。", 1],
      ["course", "信仰 ABC: 耶穌基督的信仰", "認識耶穌、十字架與救恩。", 1],
      ["course", "信仰 ABC: 聖靈與教會生活", "理解聖靈、教會與群體生活。", 1],
      ["milestone", "愛的旅程 28 天", "可由一對一陪伴或小組進行，作為慕道與初信旅程。", 28],
    ],
  },
  {
    slug: "family",
    code: "FAMILY",
    name: "家人",
    displayName: "Family / 家人",
    description: "從穩定參與進入委身、靈修、奉獻、服事與健康基督徒生活。",
    sortOrder: 2,
    sourceLabel: "Google Drive 2025 討論版",
    metadata: { legacyNames: ["Cultivate", "iM Family"], echo: "Cultivate 培育" },
    requirements: [
      ["condition", "開始靈修與奉獻", "開始讀經、禱告，並建立奉獻與財務管理的信仰習慣。", 1],
      ["participation", "主日崇拜", "至少參與 5 次主日崇拜。", 5],
      ["participation", "小組聚會", "至少參與 5 次小組。", 5],
      ["participation", "服事團隊", "至少固定參與 1 個服事團隊。", 1],
      ["participation", "教會活動", "至少參與 1 次教會活動或外展。", 1],
      ["participation", "門徒關懷 / 查經", "至少 1 次門徒陪伴、查經或生命討論。", 1],
      ["course", "健康基督徒生活: 靈修與禱告", "建立每日與神同行的節奏。", 1],
      ["course", "健康基督徒生活: 基督徒品格", "讓信仰進入情緒、關係、工作與家庭。", 1],
      ["course", "健康基督徒生活: 奉獻與財務管理", "用管家心態回應神的供應。", 1],
    ],
  },
  {
    slug: "follow",
    code: "FOLLOW",
    name: "門徒",
    displayName: "Follow / 門徒",
    description: "從被牧養的人，成為能操練真理、陪伴他人、在職場家庭活出信仰的人。",
    sortOrder: 3,
    sourceLabel: "Google Drive 2025 討論版 + Voice Memo 2026-05-26",
    metadata: { legacyNames: ["Follower", "Holistic Growth", "iM Follower"], echo: "Holistic Growth 全面成長" },
    requirements: [
      ["condition", "開始陪伴一個人", "開始帶小組、陪伴新人，或穩定門訓一個人。", 1],
      ["participation", "主日崇拜", "至少參與 5 次主日崇拜。", 5],
      ["participation", "門徒小組", "至少參與 5 次門徒小組或門訓聚集。", 5],
      ["participation", "帶領查經 / 見證", "至少 1 次帶領查經、分享見證或主動服事人。", 1],
      ["participation", "訓練 / 特會", "至少參與 1 次進階訓練、特會或督導。", 1],
      ["participation", "進階服事", "在團隊中承擔更穩定或更高責任。", 1],
      ["course", "門徒訓練與小組帶領", "學習使人成為門徒，而不只是完成課程。", 1],
      ["course", "職場與家庭門徒生活", "把 Follow 階段落進工作、家庭與日常生活。", 1],
      ["course", "屬靈領導力與服事心態", "培養不被情緒牽著走的助人者界線。", 1],
    ],
  },
  {
    slug: "firemaker",
    code: "FIRE",
    name: "領袖",
    displayName: "Firemaker / 領袖",
    description: "不是只享受火的溫暖，而是能開小組、開事工、走出去點火的人。",
    sortOrder: 4,
    sourceLabel: "Voice Memo 2026-05-26",
    metadata: { legacyNames: ["Leader", "Outreach", "iM Leader"], echo: "Outreach 擴展" },
    requirements: [
      ["condition", "能開小組或事工", "具備開小組、開事工、帶領團隊或外展點火的能力。", 1],
      ["participation", "領袖督導", "穩定參與領袖督導、debrief 或 B 層牧養支援。", 3],
      ["participation", "團隊建造", "能招聚、培育並差派同工，不只自己完成任務。", 1],
      ["participation", "外展或新事工", "至少推動 1 個外展、公共領域、職場或社區接觸點。", 1],
      ["course", "非典理論", "建立非典型思維與文化辨識能力。", 1],
      ["course", "Fire Cross", "整合 Christ DNA、使命、門徒與生命神學。", 1],
      ["course", "簡易神學 / 基督論", "具備能向人解釋信仰核心的基礎神學能力。", 1],
      ["milestone", "差派與複製", "完成一個可交接、可複製、可祝福他人的事工果子。", 1],
    ],
  },
] as const;

export async function seedPastoralFramework153() {
  const stageIds = new Map<string, string>();

  for (const stage of defaultFramework) {
    const stageResult = await pool.query<{ id: string }>(
      `INSERT INTO pastoral_framework_stages (
          slug, code, name, display_name, description, sort_order, source_label, is_active, metadata, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8::jsonb, NOW(), NOW())
        ON CONFLICT (slug) DO UPDATE
          SET code = EXCLUDED.code,
              name = EXCLUDED.name,
              display_name = EXCLUDED.display_name,
              description = EXCLUDED.description,
              sort_order = EXCLUDED.sort_order,
              source_label = EXCLUDED.source_label,
              is_active = true,
              metadata = EXCLUDED.metadata,
              updated_at = NOW()
        RETURNING id`,
      [
        stage.slug,
        stage.code,
        stage.name,
        stage.displayName,
        stage.description,
        stage.sortOrder,
        stage.sourceLabel,
        JSON.stringify(stage.metadata),
      ],
    );
    const stageId = stageResult.rows[0]?.id;
    if (!stageId) continue;
    stageIds.set(stage.slug, stageId);

    for (const [index, requirement] of stage.requirements.entries()) {
      const [requirementType, title, description, targetCount] = requirement;
      await pool.query(
        `INSERT INTO pastoral_stage_requirements (
            stage_id, requirement_type, title, description, target_count, sort_order, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          ON CONFLICT (stage_id, title) DO UPDATE
            SET requirement_type = EXCLUDED.requirement_type,
                description = EXCLUDED.description,
                target_count = EXCLUDED.target_count,
                sort_order = EXCLUDED.sort_order,
                updated_at = NOW()`,
        [stageId, requirementType, title, description, targetCount, index + 1],
      );
    }
  }

  await pool.query(
    `UPDATE pastoral_framework_stages
        SET is_active = false,
            updated_at = NOW()
      WHERE slug = 'frame'`,
  );

  await pool.query(
    `UPDATE persons
        SET pastoral_stage = CASE
              WHEN lower(trim(COALESCE(pastoral_stage, ''))) IN ('friend', 'frame', 'newcomer', 'visitor', 'guest', 'unknown', '') THEN 'friend'
              WHEN lower(trim(COALESCE(pastoral_stage, ''))) IN ('family', 'member', 'rooted') THEN 'family'
              WHEN lower(trim(COALESCE(pastoral_stage, ''))) IN ('follow', 'follower', 'disciple', 'care') THEN 'follow'
              WHEN lower(trim(COALESCE(pastoral_stage, ''))) IN ('firemaker', 'leader', 'future_leader', 'pastor') THEN 'firemaker'
              ELSE lower(trim(COALESCE(pastoral_stage, '')))
            END,
            updated_at = NOW()
      WHERE pastoral_status <> 'inactive'
        AND pastoral_stage IS DISTINCT FROM CASE
              WHEN lower(trim(COALESCE(pastoral_stage, ''))) IN ('friend', 'frame', 'newcomer', 'visitor', 'guest', 'unknown', '') THEN 'friend'
              WHEN lower(trim(COALESCE(pastoral_stage, ''))) IN ('family', 'member', 'rooted') THEN 'family'
              WHEN lower(trim(COALESCE(pastoral_stage, ''))) IN ('follow', 'follower', 'disciple', 'care') THEN 'follow'
              WHEN lower(trim(COALESCE(pastoral_stage, ''))) IN ('firemaker', 'leader', 'future_leader', 'pastor') THEN 'firemaker'
              ELSE lower(trim(COALESCE(pastoral_stage, '')))
            END`,
  );

  return { stageCount: stageIds.size };
}

export async function getPastoralFrameworkOverview(churchScope: string | null): Promise<{
  stages: PastoralFrameworkStageSummary[];
  sources: PastoralFrameworkSource[];
}> {
  const params: unknown[] = [];
  const personConditions = ["p.pastoral_status <> 'inactive'"];
  appendChurchCondition(personConditions, params, "p.church", churchScope);

  const stageCountsResult = await pool.query<{ slug: string; count: number }>(
    `SELECT
        CASE
          WHEN lower(trim(COALESCE(p.pastoral_stage, ''))) IN ('friend', 'frame', 'newcomer', 'visitor', 'guest', 'unknown', '') THEN 'friend'
          WHEN lower(trim(COALESCE(p.pastoral_stage, ''))) IN ('family', 'member', 'rooted') THEN 'family'
          WHEN lower(trim(COALESCE(p.pastoral_stage, ''))) IN ('follow', 'follower', 'disciple', 'care') THEN 'follow'
          WHEN lower(trim(COALESCE(p.pastoral_stage, ''))) IN ('firemaker', 'leader', 'future_leader', 'pastor') THEN 'firemaker'
          ELSE lower(trim(COALESCE(p.pastoral_stage, '')))
        END AS slug,
        COUNT(*)::int AS count
       FROM persons p
      WHERE ${personConditions.join(" AND ")}
      GROUP BY 1`,
    params,
  );
  const peopleByStage = new Map(stageCountsResult.rows.map((row) => [row.slug, Number(row.count)]));

  const stagesResult = await pool.query<Omit<PastoralFrameworkStageSummary, "requirements" | "peopleCount">>(
    `SELECT
        id,
        slug,
        code,
        name,
        display_name AS "displayName",
        description,
        sort_order AS "sortOrder",
        source_label AS "sourceLabel"
       FROM pastoral_framework_stages
      WHERE is_active = true
      ORDER BY sort_order ASC, name ASC`,
  );

  const stageIds = stagesResult.rows.map((stage) => stage.id);
  const requirements = stageIds.length === 0
    ? []
    : (await pool.query<PastoralFrameworkRequirement>(
      `SELECT
          id,
          stage_id AS "stageId",
          requirement_type AS "requirementType",
          title,
          description,
          target_count AS "targetCount",
          sort_order AS "sortOrder"
         FROM pastoral_stage_requirements
        WHERE stage_id = ANY($1::uuid[])
        ORDER BY sort_order ASC, title ASC`,
      [stageIds],
    )).rows;

  const requirementsByStage = new Map<string, PastoralFrameworkRequirement[]>();
  for (const requirement of requirements) {
    const list = requirementsByStage.get(requirement.stageId) ?? [];
    list.push(requirement);
    requirementsByStage.set(requirement.stageId, list);
  }

  return {
    stages: stagesResult.rows.map((stage) => ({
      ...stage,
      peopleCount: peopleByStage.get(stage.slug) ?? 0,
      requirements: requirementsByStage.get(stage.id) ?? [],
    })),
    sources: frameworkSources,
  };
}

export async function updatePersonPastoralStage(input: {
  personId: string;
  stageSlug: string;
  note?: string | null;
}, churchScope: string | null) {
  const stageSlug = mapPastoralStageSlug(input.stageSlug);
  const stage = await pool.query<{ id: string; slug: string }>(
    `SELECT id, slug FROM pastoral_framework_stages WHERE slug = $1 AND is_active = true LIMIT 1`,
    [stageSlug],
  );
  if (!stage.rows[0]) return null;

  const params: unknown[] = [input.personId, stageSlug];
  const conditions = ["id = $1"];
  appendChurchCondition(conditions, params, "church", churchScope);
  const person = await pool.query<{ id: string }>(
    `UPDATE persons
        SET pastoral_stage = $2,
            updated_at = NOW()
      WHERE ${conditions.join(" AND ")}
      RETURNING id`,
    params,
  );
  if (!person.rows[0]) return null;

  await pool.query(
    `INSERT INTO person_stage_progress (
        person_id, stage_id, status, note, started_at, created_at, updated_at
      )
      VALUES ($1, $2, 'in_progress', $3, NOW(), NOW(), NOW())
      ON CONFLICT (person_id, stage_id) DO UPDATE
        SET status = CASE
              WHEN person_stage_progress.status = 'completed' THEN person_stage_progress.status
              ELSE 'in_progress'
            END,
            note = COALESCE($3, person_stage_progress.note),
            updated_at = NOW()`,
    [input.personId, stage.rows[0].id, input.note ?? null],
  );

  return { personId: input.personId, stageSlug };
}
