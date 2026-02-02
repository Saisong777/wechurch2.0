import { db } from "../server/db";
import { 
  users, userRoles, potentialMembers, sessions, participants, 
  submissions, aiReports, studyResponses, prayers, prayerAmens, 
  prayerComments, prayerNotifications, featureToggles, cardQuestions, 
  icebreakerGames, messageCards, messageCardDownloads 
} from "../shared/schema";
import * as fs from "fs";
import * as path from "path";

function parseCSV(content: string, delimiter = ";"): Record<string, string>[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(delimiter).map(h => h.trim());
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() || "";
    });
    rows.push(row);
  }
  
  return rows;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === "") return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function parseBool(val: string): boolean {
  return val === "true" || val === "t" || val === "1";
}

function parseArrayField(val: string): string[] | null {
  if (!val || val === "" || val === "{}") return null;
  const cleaned = val.replace(/^\{|\}$/g, "").trim();
  if (!cleaned) return null;
  return cleaned.split(",").map(s => s.trim().replace(/^"|"$/g, ""));
}

async function importSessions() {
  const filePath = path.join(process.cwd(), "attached_assets", "sessions-export-2026-02-02_18-41-00_1770028991038.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Sessions CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} sessions...`);
  
  for (const row of rows) {
    try {
      await db.insert(sessions).values({
        id: row.id,
        verseReference: row.verse_reference || "Unknown",
        status: row.status || "waiting",
        groupSize: parseInt(row.group_size) || 4,
        groupingMethod: row.grouping_method || "random",
        ownerId: row.owner_id || null,
        shortCode: row.short_code || null,
        allowLatecomers: parseBool(row.allow_latecomers),
        icebreakerEnabled: parseBool(row.icebreaker_enabled),
        createdAt: parseDate(row.created_at) || new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing session ${row.id}:`, err);
    }
  }
  
  console.log("Sessions imported!");
}

async function importParticipants() {
  const filePath = path.join(process.cwd(), "attached_assets", "participants-export-2026-02-02_18-39-39_1770028991037.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Participants CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} participants...`);
  
  for (const row of rows) {
    try {
      await db.insert(participants).values({
        id: row.id,
        sessionId: row.session_id,
        name: row.name || "Unknown",
        email: row.email || "",
        gender: row.gender || "male",
        groupNumber: row.group_number ? parseInt(row.group_number) : null,
        location: row.location || "On-site",
        readyConfirmed: parseBool(row.ready_confirmed),
        joinedAt: parseDate(row.joined_at) || new Date(),
        updatedAt: parseDate(row.updated_at) || new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing participant ${row.id}:`, err);
    }
  }
  
  console.log("Participants imported!");
}

async function importSubmissions() {
  const filePath = path.join(process.cwd(), "attached_assets", "submissions-export-2026-02-02_18-41-06_1770028991039.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Submissions CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} submissions...`);
  
  for (const row of rows) {
    try {
      await db.insert(submissions).values({
        id: row.id,
        sessionId: row.session_id,
        participantId: row.participant_id,
        groupNumber: parseInt(row.group_number) || 1,
        name: row.name || "",
        email: row.email || "",
        bibleVerse: row.bible_verse || "",
        theme: row.theme || null,
        movingVerse: row.moving_verse || null,
        factsDiscovered: row.facts_discovered || null,
        traditionalExegesis: row.traditional_exegesis || null,
        inspirationFromGod: row.inspiration_from_god || null,
        applicationInLife: row.application_in_life || null,
        others: row.others || null,
        submittedAt: parseDate(row.submitted_at) || new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing submission ${row.id}:`, err);
    }
  }
  
  console.log("Submissions imported!");
}

async function importAiReports() {
  const filePath = path.join(process.cwd(), "attached_assets", "ai_reports-export-2026-02-02_18-38-14_1770028991035.csv");
  if (!fs.existsSync(filePath)) {
    console.log("AI Reports CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} AI reports...`);
  
  for (const row of rows) {
    try {
      await db.insert(aiReports).values({
        id: row.id,
        sessionId: row.session_id,
        reportType: row.report_type || "overall",
        groupNumber: row.group_number ? parseInt(row.group_number) : null,
        content: row.content || "",
        status: row.status || "COMPLETED",
        createdAt: parseDate(row.created_at) || new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing AI report ${row.id}:`, err);
    }
  }
  
  console.log("AI Reports imported!");
}

async function importStudyResponses() {
  const filePath = path.join(process.cwd(), "attached_assets", "study_responses-export-2026-02-02_18-40-07_1770028991038.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Study Responses CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} study responses...`);
  
  for (const row of rows) {
    try {
      await db.insert(studyResponses).values({
        id: row.id,
        sessionId: row.session_id,
        userId: row.user_id,
        titlePhrase: row.title_phrase || null,
        heartbeatVerse: row.heartbeat_verse || null,
        observation: row.observation || null,
        coreInsightCategory: row.core_insight_category || null,
        coreInsightNote: row.core_insight_note || null,
        scholarsNote: row.scholars_note || null,
        actionPlan: row.action_plan || null,
        coolDownNote: row.cool_down_note || null,
        createdAt: parseDate(row.created_at) || new Date(),
        updatedAt: parseDate(row.updated_at) || new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing study response ${row.id}:`, err);
    }
  }
  
  console.log("Study Responses imported!");
}

async function importPrayers() {
  const filePath = path.join(process.cwd(), "attached_assets", "prayers-export-2026-02-02_18-40-55_1770028991038.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Prayers CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} prayers...`);
  
  for (const row of rows) {
    try {
      await db.insert(prayers).values({
        id: row.id,
        userId: row.user_id,
        content: row.content || "",
        category: row.category || "other",
        isAnonymous: parseBool(row.is_anonymous),
        isPinned: parseBool(row.is_pinned),
        createdAt: parseDate(row.created_at) || new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing prayer ${row.id}:`, err);
    }
  }
  
  console.log("Prayers imported!");
}

async function importPrayerAmens() {
  const filePath = path.join(process.cwd(), "attached_assets", "prayer_amens-export-2026-02-02_18-39-46_1770028991037.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Prayer Amens CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} prayer amens...`);
  
  for (const row of rows) {
    try {
      await db.insert(prayerAmens).values({
        prayerId: row.prayer_id,
        userId: row.user_id,
        createdAt: parseDate(row.created_at) || new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing prayer amen:`, err);
    }
  }
  
  console.log("Prayer Amens imported!");
}

async function importPrayerComments() {
  const filePath = path.join(process.cwd(), "attached_assets", "prayer_comments-export-2026-02-02_18-40-49_1770028991037.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Prayer Comments CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} prayer comments...`);
  
  for (const row of rows) {
    try {
      await db.insert(prayerComments).values({
        id: row.id,
        prayerId: row.prayer_id,
        userId: row.user_id,
        content: row.content || "",
        createdAt: parseDate(row.created_at) || new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing prayer comment ${row.id}:`, err);
    }
  }
  
  console.log("Prayer Comments imported!");
}

async function importPrayerNotifications() {
  const filePath = path.join(process.cwd(), "attached_assets", "prayer_notifications-export-2026-02-02_18-39-53_1770028991037.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Prayer Notifications CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} prayer notifications...`);
  
  for (const row of rows) {
    try {
      await db.insert(prayerNotifications).values({
        id: row.id,
        userId: row.user_id,
        prayerId: row.prayer_id,
        type: row.type || "amen",
        actorName: row.actor_name || null,
        isRead: parseBool(row.is_read),
        createdAt: parseDate(row.created_at) || new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing prayer notification ${row.id}:`, err);
    }
  }
  
  console.log("Prayer Notifications imported!");
}

async function importFeatureToggles() {
  const filePath = path.join(process.cwd(), "attached_assets", "feature_toggles-export-2026-02-02_18-39-08_1770028991036.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Feature Toggles CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} feature toggles...`);
  
  for (const row of rows) {
    try {
      await db.insert(featureToggles).values({
        id: row.id,
        featureKey: row.feature_key,
        featureName: row.feature_name || "",
        description: row.description || null,
        isEnabled: parseBool(row.is_enabled),
        disabledMessage: row.disabled_message || "即將推出",
        updatedAt: parseDate(row.updated_at) || new Date(),
        updatedBy: row.updated_by || null,
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing feature toggle ${row.feature_key}:`, err);
    }
  }
  
  console.log("Feature Toggles imported!");
}

async function importCardQuestions() {
  const filePath = path.join(process.cwd(), "attached_assets", "card_questions-export-2026-02-02_18-40-18_1770028991036.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Card Questions CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} card questions...`);
  
  for (const row of rows) {
    try {
      await db.insert(cardQuestions).values({
        id: row.id,
        contentText: row.content_text || "",
        contentTextEn: row.content_text_en || null,
        level: row.level || "easy",
        isActive: parseBool(row.is_active),
        sortOrder: row.sort_order ? parseInt(row.sort_order) : null,
        createdAt: parseDate(row.created_at) || new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing card question ${row.id}:`, err);
    }
  }
  
  console.log("Card Questions imported!");
}

async function importIcebreakerGames() {
  const filePath = path.join(process.cwd(), "attached_assets", "icebreaker_games-export-2026-02-02_18-40-24_1770028991036.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Icebreaker Games CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} icebreaker games...`);
  
  for (const row of rows) {
    try {
      await db.insert(icebreakerGames).values({
        id: row.id,
        roomCode: row.room_code || "",
        status: row.status || "waiting",
        mode: row.mode || "free",
        currentLevel: row.current_level || null,
        currentCardId: row.current_card_id || null,
        usedCardIds: parseArrayField(row.used_card_ids),
        passCount: row.pass_count ? parseInt(row.pass_count) : 0,
        bibleStudySessionId: row.bible_study_session_id || null,
        groupNumber: row.group_number ? parseInt(row.group_number) : null,
        timerDuration: row.timer_duration ? parseInt(row.timer_duration) : 60,
        timerStartedAt: parseDate(row.timer_started_at),
        timerRunning: parseBool(row.timer_running),
        sharingMode: parseBool(row.sharing_mode),
        sharedMemberIds: parseArrayField(row.shared_member_ids),
        currentDrawerId: row.current_drawer_id || null,
        currentDrawerCardId: row.current_drawer_card_id || null,
        drawerOrder: parseArrayField(row.drawer_order),
        createdAt: parseDate(row.created_at) || new Date(),
        updatedAt: parseDate(row.updated_at) || new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing icebreaker game ${row.id}:`, err);
    }
  }
  
  console.log("Icebreaker Games imported!");
}

async function importMessageCards() {
  const filePath = path.join(process.cwd(), "attached_assets", "message_cards-export-2026-02-02_18-40-32_1770028991036.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Message Cards CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} message cards...`);
  
  for (const row of rows) {
    try {
      await db.insert(messageCards).values({
        id: row.id,
        title: row.title || "",
        shortCode: row.short_code || row.id,
        imagePath: row.image_path || "",
        createdAt: parseDate(row.created_at) || new Date(),
        createdBy: row.created_by || null,
        isActive: parseBool(row.is_active),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing message card ${row.id}:`, err);
    }
  }
  
  console.log("Message Cards imported!");
}

async function importMessageCardDownloads() {
  const filePath = path.join(process.cwd(), "attached_assets", "message_card_downloads-export-2026-02-02_18-39-27_1770028991036.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Message Card Downloads CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} message card downloads...`);
  
  for (const row of rows) {
    try {
      await db.insert(messageCardDownloads).values({
        id: row.id,
        cardId: row.card_id,
        userId: row.user_id || null,
        userName: row.user_name || "",
        userEmail: row.user_email || "",
        downloadedAt: parseDate(row.downloaded_at) || new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing message card download ${row.id}:`, err);
    }
  }
  
  console.log("Message Card Downloads imported!");
}

async function importPotentialMembers() {
  const filePath = path.join(process.cwd(), "attached_assets", "potential_members-export-2026-02-02_12-48-11_1770028391451.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Potential members CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} potential members...`);
  
  for (const row of rows) {
    try {
      await db.insert(potentialMembers).values({
        id: row.id,
        email: row.email,
        name: row.name,
        gender: row.gender || null,
        userId: row.user_id || null,
        status: row.status || "pending",
        subscribed: row.subscribed === "true",
        firstJoinedAt: row.first_joined_at ? new Date(row.first_joined_at) : new Date(),
        lastSessionAt: row.last_session_at ? new Date(row.last_session_at) : new Date(),
        sessionsCount: parseInt(row.sessions_count) || 1,
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
        updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing potential member ${row.email}:`, err);
    }
  }
  
  console.log("Potential members imported!");
}

async function importProfiles() {
  const filePath = path.join(process.cwd(), "attached_assets", "profiles-export-2026-02-02_12-55-12_1770028391453.csv");
  if (!fs.existsSync(filePath)) {
    console.log("Profiles CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} user profiles...`);
  
  for (const row of rows) {
    try {
      await db.insert(users).values({
        id: row.user_id,
        email: row.email,
        password: "migrated_user",
        displayName: row.display_name || null,
        avatarUrl: row.avatar_url || null,
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
        updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing profile ${row.email}:`, err);
    }
  }
  
  console.log("Profiles imported!");
}

async function importUserRoles() {
  const filePath = path.join(process.cwd(), "attached_assets", "user_roles-export-2026-02-02_13-11-12_1770028391453.csv");
  if (!fs.existsSync(filePath)) {
    console.log("User roles CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);
  
  console.log(`Importing ${rows.length} user roles...`);
  
  for (const row of rows) {
    try {
      await db.insert(userRoles).values({
        id: row.id,
        userId: row.user_id,
        role: row.role as any || "member",
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
        updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`Error importing user role for ${row.user_id}:`, err);
    }
  }
  
  console.log("User roles imported!");
}

async function main() {
  console.log("Starting CSV import for all tables...\n");
  
  console.log("=== Phase 1: Core user data ===");
  await importProfiles();
  await importUserRoles();
  await importPotentialMembers();
  
  console.log("\n=== Phase 2: Sessions and study data ===");
  await importSessions();
  await importParticipants();
  await importSubmissions();
  await importStudyResponses();
  await importAiReports();
  
  console.log("\n=== Phase 3: Feature toggles ===");
  await importFeatureToggles();
  
  console.log("\n=== Phase 4: Prayer wall ===");
  await importPrayers();
  await importPrayerAmens();
  await importPrayerComments();
  await importPrayerNotifications();
  
  console.log("\n=== Phase 5: Icebreaker games ===");
  await importCardQuestions();
  await importIcebreakerGames();
  
  console.log("\n=== Phase 6: Message cards ===");
  await importMessageCards();
  await importMessageCardDownloads();
  
  console.log("\n=== CSV import completed! ===");
  process.exit(0);
}

main().catch(console.error);
