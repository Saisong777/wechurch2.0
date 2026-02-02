import { db } from "../server/db";
import {
  chineseUnionTrad,
  jesus4Seasons,
  jesusDailyContent,
  devotionalNotes,
  savedVerses,
  readingPlanTemplates,
  readingPlanTemplateItems,
  userReadingPlans,
  userReadingProgress,
} from "../shared/schema";
import * as fs from "fs";
import * as path from "path";

function parseCSV(content: string, delimiter = ";"): Record<string, string>[] {
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(delimiter).map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let currentValue = "";
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = "";
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());

    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      rows.push(row);
    }
  }

  return rows;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function parseBoolean(value: string): boolean {
  return value.toLowerCase() === "true";
}

function parseIntOrNull(value: string): number | null {
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

async function importChineseUnionTrad() {
  console.log("Importing Chinese Union Traditional Bible...");
  const filePath = path.join(process.cwd(), "csv_imports", "chinese_union_trad-export-2026-02-02_21-09-35_1770047287268.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} verses to import`);

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch.map((row) => ({
      verseId: parseInt(row["Verse ID"], 10),
      bookName: row["Book Name"],
      bookNumber: parseIntOrNull(row["Book Number"]),
      chapter: parseInt(row["Chapter"], 10),
      verse: parseInt(row["Verse"], 10),
      text: row["Text"],
    }));

    try {
      await db.insert(chineseUnionTrad).values(values).onConflictDoNothing();
      console.log(`Imported batch ${i / batchSize + 1}/${Math.ceil(rows.length / batchSize)}`);
    } catch (error) {
      console.error(`Error importing batch:`, error);
    }
  }

  console.log("Chinese Union Traditional Bible import complete!");
}

async function importJesus4Seasons() {
  console.log("Importing Jesus 4 Seasons timeline...");
  const filePath = path.join(process.cwd(), "csv_imports", "jesus_4seasons-export-2026-02-02_21-10-14_1770047287270.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} events to import`);

  for (const row of rows) {
    try {
      await db.insert(jesus4Seasons).values({
        displayOrder: parseInt(row["display_order"], 10) || 0,
        eventId: row["EventID"] || null,
        dateMaybe: row["Date_Maybe"] || null,
        dateStage: row["Date_Stage"] || null,
        stageShort: row["Stage_Short"] || null,
        season: row["季節"] || "",
        approximateDate: row["大約日期"] || null,
        location: row["地點"] || null,
        eventName: row["事件名稱"] || "",
        eventCategory: row["事件分類"] || null,
        theologicalTheme: row["神學主題"] || null,
        jesusCharacter: row["耶穌品格"] || null,
        focus: row["焦點"] || null,
        gospelCenter: row["福音中心"] || null,
        scriptureOverview: row["經文總覽"] || null,
        scriptureMt: row["經文_太"] || null,
        scriptureMk: row["經文_可"] || null,
        scriptureLk: row["經文_路"] || null,
        scriptureJn: row["經文_約"] || null,
        scriptureStatus: row["經文狀態"] || null,
        harmonyPrinciple: row["合參原則"] || null,
        dateConfidence: row["年代確信度"] || null,
        orderConfidence: row["順序確信度"] || null,
        dataType: row["資料類型"] || null,
        categoryFiveMain: row["事件分類_五大精分"] || null,
        categoryResearchBasis: row["分類依據_研究級"] || null,
        teachingThemeResearch: row["教導_主題_研究級"] || null,
        categoryResearchDetail: row["事件分類_研究級_細分"] || null,
        teachingKingdomSecondary: row["教導_天國_二級主題"] || null,
        parableSecondary: row["比喻_二級主題"] || null,
        miracleSecondary: row["神蹟_二級主題"] || null,
        categoryResearchFinal: row["事件分類_研究級_終版"] || null,
        demonstrationSecondary: row["示範_二級主題"] || null,
        wisdomSecondary: row["智慧_二級主題"] || null,
        humorSecondary: row["幽默_二級主題"] || null,
        categoryResearchUltimate: row["事件分類_研究級_究極版"] || null,
        categoryTags: row["事件分類_標籤"] || null,
        ntCrossReference: row["新約互文"] || null,
        ntCrossReferenceReason: row["新約互文_原因"] || null,
        ntCrossReferenceEvent: row["新約互文_事件"] || null,
        ntCrossReferenceConclusion: row["新約互文_結論"] || null,
        themeIndexResearch: row["主題索引_研究級"] || null,
        otMessiahCrossRef: row["舊約彌賽亞互文"] || null,
        otScriptureQuoteJesus: row["舊約引用_耶穌"] || null,
        typologyPeople: row["預表_人物"] || null,
        otScriptureQuoteJesusExpanded: row["舊約引用_耶穌_展開"] || null,
        typologyPrimaryLevel: row["預表_一級"] || null,
        typologySecondaryLevel: row["預表_二級"] || null,
        gospelCenterMicroNarrative: row["福音中心_微敘事"] || null,
        gospelCenterOld: row["福音中心_舊"] || null,
        userPainPointTags: row["用戶痛點_標籤"] || null,
        takeawayPhrase: row["金句"] || null,
        userPainPointPrimary: row["用戶痛點_主"] || null,
        userPainPointSecondary: row["用戶痛點_次"] || null,
      }).onConflictDoNothing();
    } catch (error) {
      console.error(`Error importing event ${row["EventID"]}:`, error);
    }
  }

  console.log("Jesus 4 Seasons import complete!");
}

async function importJesusDailyContent() {
  console.log("Importing Jesus Daily Content...");
  const filePath = path.join(process.cwd(), "csv_imports", "jesus_daily_content-export-2026-02-02_21-12-15_1770047287270.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} daily content items to import`);

  for (const row of rows) {
    try {
      await db.insert(jesusDailyContent).values({
        id: row["id"],
        month: parseInt(row["month"], 10),
        eventId: row["event_id"],
        eventName: row["event_name"],
        location: row["location"] || null,
        scriptureOverview: row["scripture_overview"] || null,
        aiDescription: row["ai_description"],
        imageUrl: row["image_url"] || null,
        dateMaybe: row["date_maybe"] || null,
        createdAt: parseDate(row["created_at"]) || new Date(),
        updatedAt: parseDate(row["updated_at"]) || new Date(),
      }).onConflictDoNothing();
    } catch (error) {
      console.error(`Error importing daily content ${row["id"]}:`, error);
    }
  }

  console.log("Jesus Daily Content import complete!");
}

async function importDevotionalNotes() {
  console.log("Importing Devotional Notes...");
  const filePath = path.join(process.cwd(), "csv_imports", "devotional_notes-export-2026-02-02_21-11-18_1770047287268.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} devotional notes to import`);

  for (const row of rows) {
    try {
      await db.insert(devotionalNotes).values({
        id: row["id"],
        userId: row["user_id"],
        verseReference: row["verse_reference"],
        verseText: row["verse_text"],
        theme: row["theme"] || null,
        keyVerse: row["key_verse"] || null,
        newUnderstanding: row["new_understanding"] || null,
        promises: row["promises"] || null,
        notes: row["notes"] || null,
        createdAt: parseDate(row["created_at"]) || new Date(),
        updatedAt: parseDate(row["updated_at"]) || new Date(),
      }).onConflictDoNothing();
    } catch (error) {
      console.error(`Error importing devotional note ${row["id"]}:`, error);
    }
  }

  console.log("Devotional Notes import complete!");
}

async function importSavedVerses() {
  console.log("Importing Saved Verses...");
  const filePath = path.join(process.cwd(), "csv_imports", "saved_verses-export-2026-02-02_21-12-34_1770047287271.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} saved verses to import`);

  for (const row of rows) {
    try {
      await db.insert(savedVerses).values({
        id: row["id"],
        userId: row["user_id"],
        verseReference: row["verse_reference"],
        verseText: row["verse_text"],
        bookName: row["book_name"],
        chapter: parseInt(row["chapter"], 10),
        verseStart: parseInt(row["verse_start"], 10),
        verseEnd: parseIntOrNull(row["verse_end"]),
        notes: row["notes"] || null,
        createdAt: parseDate(row["created_at"]) || new Date(),
      }).onConflictDoNothing();
    } catch (error) {
      console.error(`Error importing saved verse ${row["id"]}:`, error);
    }
  }

  console.log("Saved Verses import complete!");
}

async function importReadingPlanTemplates() {
  console.log("Importing Reading Plan Templates...");
  const filePath = path.join(process.cwd(), "csv_imports", "reading_plan_templates-export-2026-02-02_21-10-25_1770047287271.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} templates to import`);

  for (const row of rows) {
    try {
      await db.insert(readingPlanTemplates).values({
        id: row["id"],
        name: row["name"],
        description: row["description"] || null,
        category: row["category"] || "custom",
        durationDays: parseInt(row["duration_days"], 10) || 365,
        isPublic: parseBoolean(row["is_public"]),
        createdBy: row["created_by"] || null,
        createdAt: parseDate(row["created_at"]) || new Date(),
        updatedAt: parseDate(row["updated_at"]) || new Date(),
      }).onConflictDoNothing();
    } catch (error) {
      console.error(`Error importing template ${row["id"]}:`, error);
    }
  }

  console.log("Reading Plan Templates import complete!");
}

async function importReadingPlanTemplateItems() {
  console.log("Importing Reading Plan Template Items...");
  const filePath = path.join(process.cwd(), "csv_imports", "reading_plan_template_items-export-2026-02-02_21-12-25_1770047287271.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} template items to import`);

  for (const row of rows) {
    try {
      await db.insert(readingPlanTemplateItems).values({
        id: row["id"],
        templateId: row["template_id"],
        dayNumber: parseInt(row["day_number"], 10),
        title: row["title"] || null,
        bookName: row["book_name"] || null,
        chapterStart: parseIntOrNull(row["chapter_start"]),
        chapterEnd: parseIntOrNull(row["chapter_end"]),
        verseStart: parseIntOrNull(row["verse_start"]),
        verseEnd: parseIntOrNull(row["verse_end"]),
        scriptureReference: row["scripture_reference"] || null,
        notes: row["notes"] || null,
      }).onConflictDoNothing();
    } catch (error) {
      console.error(`Error importing template item ${row["id"]}:`, error);
    }
  }

  console.log("Reading Plan Template Items import complete!");
}

async function importUserReadingPlans() {
  console.log("Importing User Reading Plans...");
  const filePath = path.join(process.cwd(), "csv_imports", "user_reading_plans-export-2026-02-02_21-10-31_1770047287271.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} user plans to import`);

  for (const row of rows) {
    try {
      await db.insert(userReadingPlans).values({
        id: row["id"],
        userId: row["user_id"],
        templateId: row["template_id"] || null,
        name: row["name"],
        description: row["description"] || null,
        startDate: row["start_date"],
        endDate: row["end_date"] || null,
        isActive: parseBoolean(row["is_active"]),
        createdAt: parseDate(row["created_at"]) || new Date(),
        updatedAt: parseDate(row["updated_at"]) || new Date(),
      }).onConflictDoNothing();
    } catch (error) {
      console.error(`Error importing user plan ${row["id"]}:`, error);
    }
  }

  console.log("User Reading Plans import complete!");
}

async function importUserReadingProgress() {
  console.log("Importing User Reading Progress...");
  const filePath = path.join(process.cwd(), "csv_imports", "user_reading_progress-export-2026-02-02_21-12-43_1770047287272.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} progress records to import`);

  for (const row of rows) {
    try {
      await db.insert(userReadingProgress).values({
        id: row["id"],
        userId: row["user_id"],
        planId: row["plan_id"],
        dayNumber: parseInt(row["day_number"], 10),
        readingDate: row["reading_date"],
        scriptureReference: row["scripture_reference"],
        isCompleted: parseBoolean(row["is_completed"]),
        completedAt: parseDate(row["completed_at"]),
        devotionalNoteId: row["devotional_note_id"] || null,
        createdAt: parseDate(row["created_at"]) || new Date(),
      }).onConflictDoNothing();
    } catch (error) {
      console.error(`Error importing progress ${row["id"]}:`, error);
    }
  }

  console.log("User Reading Progress import complete!");
}

async function main() {
  console.log("Starting Rejesus data import...\n");

  try {
    await importReadingPlanTemplates();
    await importReadingPlanTemplateItems();
    await importUserReadingPlans();
    await importUserReadingProgress();
    await importDevotionalNotes();
    await importSavedVerses();
    await importJesusDailyContent();
    await importJesus4Seasons();
    await importChineseUnionTrad();

    console.log("\n=== Import Summary ===");
    console.log("All Rejesus data imported successfully!");
  } catch (error) {
    console.error("Import failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
