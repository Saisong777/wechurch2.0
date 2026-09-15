import { getChurchAliases, normalizeChurch, UNASSIGNED_CHURCH_ID } from "./churches";
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

export function isFacilitySchemaMissingError(error: unknown) {
  const maybeError = error as { code?: string };
  return maybeError?.code === "42P01" || maybeError?.code === "42703";
}

export class FacilityBookingConflictError extends Error {
  conflicts: FacilityBookingSummary[];

  constructor(conflicts: FacilityBookingSummary[]) {
    super("Facility booking conflicts with existing bookings");
    this.name = "FacilityBookingConflictError";
    this.conflicts = conflicts;
  }
}

export interface FacilityRoomSummary {
  id: string;
  church: string | null;
  name: string;
  category: string;
  location: string | null;
  capacity: number;
  description: string | null;
  priority: number;
  isActive: boolean;
  upcomingBookingCount: number;
}

export interface FacilityBookingSummary {
  id: string;
  roomId: string;
  roomName: string;
  church: string | null;
  title: string;
  purpose: string;
  requesterPersonId: string | null;
  requesterName: string | null;
  requesterUserId: string | null;
  startAt: string;
  endAt: string;
  status: string;
  priority: number;
  note: string | null;
  conflictCount: number;
}

function parseTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.getTime();
}

export function timeRangesOverlap(startA: string | Date, endA: string | Date, startB: string | Date, endB: string | Date) {
  return parseTime(startA) < parseTime(endB) && parseTime(endA) > parseTime(startB);
}

async function assertRoomVisible(roomId: string, churchScope: string | null) {
  const params: unknown[] = [roomId];
  const conditions = ["id = $1", "is_active = true"];
  appendChurchCondition(conditions, params, "church", churchScope);
  const result = await pool.query<{ id: string; church: string | null }>(
    `SELECT id, church FROM facility_rooms WHERE ${conditions.join(" AND ")} LIMIT 1`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function listFacilityRooms(churchScope: string | null): Promise<FacilityRoomSummary[]> {
  const params: unknown[] = [];
  const conditions = ["r.is_active = true"];
  appendChurchCondition(conditions, params, "r.church", churchScope);

  const result = await pool.query<FacilityRoomSummary>(
    `SELECT
        r.id,
        r.church,
        r.name,
        r.category,
        r.location,
        r.capacity,
        r.description,
        r.priority,
        r.is_active AS "isActive",
        COALESCE(b.booking_count, 0)::int AS "upcomingBookingCount"
       FROM facility_rooms r
       LEFT JOIN (
         SELECT room_id, COUNT(*)::int AS booking_count
           FROM facility_bookings
          WHERE end_at >= NOW() - INTERVAL '1 day'
            AND status IN ('pending', 'approved')
          GROUP BY room_id
       ) b ON b.room_id = r.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY r.priority DESC, r.name ASC`,
    params,
  );
  return result.rows;
}

export async function listFacilityBookings(churchScope: string | null): Promise<FacilityBookingSummary[]> {
  const params: unknown[] = [];
  const conditions = [
    "b.end_at >= NOW() - INTERVAL '14 days'",
    "b.start_at <= NOW() + INTERVAL '120 days'",
    "r.id = b.room_id",
  ];
  appendChurchCondition(conditions, params, "r.church", churchScope);

  const result = await pool.query<Omit<FacilityBookingSummary, "conflictCount">>(
    `SELECT
        b.id,
        b.room_id AS "roomId",
        r.name AS "roomName",
        b.church,
        b.title,
        b.purpose,
        b.requester_person_id AS "requesterPersonId",
        p.display_name AS "requesterName",
        b.requester_user_id AS "requesterUserId",
        b.start_at::text AS "startAt",
        b.end_at::text AS "endAt",
        b.status,
        b.priority,
        b.note
       FROM facility_bookings b
       JOIN facility_rooms r ON ${conditions.join(" AND ")}
       LEFT JOIN persons p ON p.id = b.requester_person_id
      ORDER BY b.start_at ASC
      LIMIT 240`,
    params,
  );

  const rows = result.rows;
  return rows.map((booking) => ({
    ...booking,
    conflictCount: rows.filter((candidate) => (
      candidate.id !== booking.id
      && candidate.roomId === booking.roomId
      && ["pending", "approved"].includes(candidate.status)
      && ["pending", "approved"].includes(booking.status)
      && timeRangesOverlap(booking.startAt, booking.endAt, candidate.startAt, candidate.endAt)
    )).length,
  }));
}

export async function getFacilityBookingOverview(churchScope: string | null) {
  const [rooms, bookings] = await Promise.all([
    listFacilityRooms(churchScope),
    listFacilityBookings(churchScope),
  ]);

  return { rooms, bookings };
}

export async function createFacilityRoom(input: {
  church: string | null;
  name: string;
  category?: string;
  location?: string | null;
  capacity?: number;
  description?: string | null;
  priority?: number;
}) {
  const result = await pool.query<FacilityRoomSummary>(
    `INSERT INTO facility_rooms (
        church, name, category, location, capacity, description, priority, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
      ON CONFLICT (church, name) DO UPDATE
        SET category = EXCLUDED.category,
            location = EXCLUDED.location,
            capacity = EXCLUDED.capacity,
            description = EXCLUDED.description,
            priority = EXCLUDED.priority,
            is_active = true,
            updated_at = NOW()
      RETURNING
        id,
        church,
        name,
        category,
        location,
        capacity,
        description,
        priority,
        is_active AS "isActive",
        0::int AS "upcomingBookingCount"`,
    [
      normalizeChurch(input.church),
      input.name,
      input.category || "classroom",
      input.location ?? null,
      input.capacity ?? 12,
      input.description ?? null,
      input.priority ?? 50,
    ],
  );
  return result.rows[0];
}

export async function findFacilityBookingConflicts(input: {
  roomId: string;
  startAt: string;
  endAt: string;
  excludeBookingId?: string | null;
}, churchScope: string | null): Promise<FacilityBookingSummary[]> {
  const params: unknown[] = [input.roomId, input.startAt, input.endAt, input.excludeBookingId ?? null];
  const conditions = [
    "b.room_id = $1",
    "b.status IN ('pending', 'approved')",
    "b.start_at < $3::timestamp",
    "b.end_at > $2::timestamp",
    "($4::uuid IS NULL OR b.id <> $4::uuid)",
    "r.id = b.room_id",
  ];
  appendChurchCondition(conditions, params, "r.church", churchScope);

  const result = await pool.query<FacilityBookingSummary>(
    `SELECT
        b.id,
        b.room_id AS "roomId",
        r.name AS "roomName",
        b.church,
        b.title,
        b.purpose,
        b.requester_person_id AS "requesterPersonId",
        p.display_name AS "requesterName",
        b.requester_user_id AS "requesterUserId",
        b.start_at::text AS "startAt",
        b.end_at::text AS "endAt",
        b.status,
        b.priority,
        b.note,
        0::int AS "conflictCount"
       FROM facility_bookings b
       JOIN facility_rooms r ON ${conditions.join(" AND ")}
       LEFT JOIN persons p ON p.id = b.requester_person_id
      ORDER BY b.priority DESC, b.start_at ASC`,
    params,
  );
  return result.rows;
}

export async function createFacilityBooking(input: {
  roomId: string;
  title: string;
  purpose?: string;
  requesterPersonId?: string | null;
  requesterUserId?: string | null;
  startAt: string;
  endAt: string;
  priority?: number;
  note?: string | null;
  createdByUserId?: string | null;
  allowConflict?: boolean;
}, churchScope: string | null) {
  const room = await assertRoomVisible(input.roomId, churchScope);
  if (!room) return null;

  if (parseTime(input.startAt) >= parseTime(input.endAt)) {
    throw new Error("Booking end time must be after start time");
  }

  const conflicts = await findFacilityBookingConflicts({
    roomId: input.roomId,
    startAt: input.startAt,
    endAt: input.endAt,
  }, churchScope);
  if (conflicts.length > 0 && !input.allowConflict) {
    throw new FacilityBookingConflictError(conflicts);
  }

  const result = await pool.query<FacilityBookingSummary>(
    `INSERT INTO facility_bookings (
        room_id, church, title, purpose, requester_person_id, requester_user_id,
        start_at, end_at, status, priority, note, created_by_user_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5::uuid, $6::uuid, $7::timestamp, $8::timestamp, 'pending', $9, $10, $11::uuid, NOW(), NOW())
      RETURNING
        id,
        room_id AS "roomId",
        (SELECT name FROM facility_rooms WHERE id = room_id) AS "roomName",
        church,
        title,
        purpose,
        requester_person_id AS "requesterPersonId",
        (SELECT display_name FROM persons WHERE id = requester_person_id) AS "requesterName",
        requester_user_id AS "requesterUserId",
        start_at::text AS "startAt",
        end_at::text AS "endAt",
        status,
        priority,
        note,
        0::int AS "conflictCount"`,
    [
      input.roomId,
      room.church ?? normalizeChurch(churchScope),
      input.title,
      input.purpose || "small_group",
      input.requesterPersonId ?? null,
      input.requesterUserId ?? null,
      input.startAt,
      input.endAt,
      input.priority ?? 50,
      input.note ?? null,
      input.createdByUserId ?? null,
    ],
  );
  return result.rows[0];
}

export async function updateFacilityBookingStatus(
  bookingId: string,
  status: string,
  userId: string | null,
  churchScope: string | null,
) {
  const params: unknown[] = [bookingId, status, userId];
  const conditions = ["b.id = $1", "r.id = b.room_id"];
  appendChurchCondition(conditions, params, "r.church", churchScope);

  const result = await pool.query<FacilityBookingSummary>(
    `UPDATE facility_bookings b
        SET status = $2,
            approved_by_user_id = CASE WHEN $2 = 'approved' THEN $3::uuid ELSE b.approved_by_user_id END,
            approved_at = CASE WHEN $2 = 'approved' THEN COALESCE(b.approved_at, NOW()) ELSE b.approved_at END,
            updated_at = NOW()
       FROM facility_rooms r
      WHERE ${conditions.join(" AND ")}
      RETURNING
        b.id,
        b.room_id AS "roomId",
        r.name AS "roomName",
        b.church,
        b.title,
        b.purpose,
        b.requester_person_id AS "requesterPersonId",
        (SELECT display_name FROM persons WHERE id = b.requester_person_id) AS "requesterName",
        b.requester_user_id AS "requesterUserId",
        b.start_at::text AS "startAt",
        b.end_at::text AS "endAt",
        b.status,
        b.priority,
        b.note,
        0::int AS "conflictCount"`,
    params,
  );
  return result.rows[0] ?? null;
}

const defaultRooms = [
  { name: "主堂", category: "service", location: "1F", capacity: 120, priority: 100, description: "主日、特會、敬拜與大型聚會。" },
  { name: "副堂", category: "classroom", location: "1F", capacity: 40, priority: 88, description: "課程、參訪、禱告會、小型特會與敬拜夜候補場地。" },
  { name: "國小教室", category: "kids", location: "2F", capacity: 30, priority: 86, description: "國小班與兒童主日學；超過 30 人需評估移動線或換場地。" },
  { name: "幼幼教室", category: "kids", location: "2F", capacity: 28, priority: 84, description: "幼幼班與家長陪同空間；需特別留意安全、廁所與音量。" },
  { name: "青少年教室", category: "youth", location: "2F", capacity: 24, priority: 72, description: "青少、小家、課程與週間聚集。" },
  { name: "教室 A", category: "classroom", location: "2F", capacity: 20, priority: 70, description: "門訓課程、同工訓練與週間課程。" },
  { name: "教室 B", category: "classroom", location: "2F", capacity: 16, priority: 65, description: "小班課程、兒童或青少聚集。" },
  { name: "小組教室", category: "small_group", location: "2F", capacity: 12, priority: 60, description: "週間小組、一對一陪談與牧養對話。" },
  { name: "VIP 室", category: "meeting", location: "1F", capacity: 8, priority: 55, description: "需預約的小型會談與事工團隊使用。" },
];

export async function seedDefaultFacilityRooms(churchScope: string | null) {
  const church = churchScope === UNASSIGNED_CHURCH_ID ? null : normalizeChurch(churchScope);
  const rooms: FacilityRoomSummary[] = [];
  for (const room of defaultRooms) {
    rooms.push(await createFacilityRoom({ church, ...room }));
  }
  return { roomCount: rooms.length };
}
