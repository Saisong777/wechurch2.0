import { db } from "../server/db";
import { users, userRoles, potentialMembers } from "../shared/schema";
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
  console.log("Starting CSV import...\n");
  
  await importProfiles();
  await importPotentialMembers();
  await importUserRoles();
  
  console.log("\nCSV import completed!");
  process.exit(0);
}

main().catch(console.error);
