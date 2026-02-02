import { db } from "../server/db";
import { sessions, blessingVerses } from "../shared/schema";
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

function parseIntOrNull(value: string): number | null {
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

async function importBibleStudySessions() {
  console.log("Importing Bible Study Sessions...");
  const filePath = path.join(process.cwd(), "csv_imports", "bible_study_sessions-export-2026-02-02_21-09-24_1770047320083.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} sessions to import`);

  for (const row of rows) {
    try {
      await db.insert(sessions).values({
        id: row["id"],
        scriptureToday: row["scripture_today"] || null,
        sessionDate: row["session_date"] || null,
        title: row["title"] || null,
        googleSheetUrl: row["google_sheet_url"] || null,
        status: row["status"] || "collecting",
        createdBy: row["created_by"] || null,
        createdAt: parseDate(row["created_at"]) || new Date(),
        updatedAt: parseDate(row["updated_at"]) || new Date(),
      }).onConflictDoNothing();
      console.log(`Imported session: ${row["title"]}`);
    } catch (error) {
      console.error(`Error importing session ${row["id"]}:`, error);
    }
  }

  console.log("Bible Study Sessions import complete!");
}

async function importBlessingVerses() {
  console.log("Importing Blessing Verses...");
  const filePath = path.join(process.cwd(), "csv_imports", "blessing_verses-export-2026-02-02_21-11-06_1770047320085.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} blessing verses to import`);

  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch.map((row) => ({
      verseId: parseInt(row["verse_id"], 10),
      bookName: row["book_name"],
      bookNumber: parseIntOrNull(row["book_number"]),
      chapter: parseInt(row["chapter"], 10),
      verse: parseInt(row["verse"], 10),
      text: row["text"],
      blessingVerse: row["blessing_verse"] || null,
      blessingType: row["blessing_type"] || null,
      aiPastoralSafety: row["ai_pastoral_safety"] || null,
      textNorm: row["text_norm"] || null,
      upliftScore: parseIntOrNull(row["uplift_score"]),
      emotionalFocus: row["emotional_focus"] || null,
      createdAt: parseDate(row["created_at"]) || new Date(),
    }));

    try {
      await db.insert(blessingVerses).values(values).onConflictDoNothing();
      console.log(`Imported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rows.length / batchSize)}`);
    } catch (error) {
      console.error(`Error importing batch:`, error);
    }
  }

  console.log("Blessing Verses import complete!");
}

async function main() {
  console.log("Starting additional data import...\n");

  try {
    await importBibleStudySessions();
    await importBlessingVerses();

    console.log("\n=== Import Summary ===");
    console.log("All additional data imported successfully!");
  } catch (error) {
    console.error("Import failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
