import { db } from "../server/db";
import { aiReports } from "../shared/schema";
import * as fs from "fs";
import * as path from "path";
import { eq } from "drizzle-orm";

function parseQuotedCSV(content: string, delimiter = ";"): Record<string, string>[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(delimiter).map(h => h.trim());
  const rows: Record<string, string>[] = [];
  
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let lineIndex = 1;
  
  while (lineIndex < lines.length) {
    const line = lines[lineIndex];
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = "";
      } else {
        currentField += char;
      }
    }
    
    if (inQuotes) {
      currentField += "\n";
      lineIndex++;
      continue;
    }
    
    currentRow.push(currentField.trim());
    
    if (currentRow.length >= headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = currentRow[idx] || "";
      });
      rows.push(row);
    }
    
    currentRow = [];
    currentField = "";
    lineIndex++;
  }
  
  return rows;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === "") return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

async function importAiReports() {
  const filePath = path.join(process.cwd(), "attached_assets", "ai_reports-export-2026-02-02_18-38-14_1770028991035.csv");
  if (!fs.existsSync(filePath)) {
    console.log("AI Reports CSV not found");
    return;
  }
  
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseQuotedCSV(content);
  
  console.log(`Found ${rows.length} AI reports to import...`);
  
  let imported = 0;
  let skipped = 0;
  
  for (const row of rows) {
    if (!isValidUUID(row.id)) {
      console.log(`Skipping invalid UUID: ${row.id?.substring(0, 30)}...`);
      skipped++;
      continue;
    }
    
    if (!isValidUUID(row.session_id)) {
      console.log(`Skipping invalid session_id for report ${row.id}`);
      skipped++;
      continue;
    }
    
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
      imported++;
    } catch (err: any) {
      console.error(`Error importing AI report ${row.id}:`, err.message);
    }
  }
  
  console.log(`AI Reports: ${imported} imported, ${skipped} skipped`);
}

async function main() {
  console.log("Re-importing AI Reports with proper CSV parsing...\n");
  await importAiReports();
  console.log("\nDone!");
  process.exit(0);
}

main().catch(console.error);
