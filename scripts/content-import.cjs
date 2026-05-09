#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const pg = require("pg");
const { CONTENT_EXPORT_DIR, TABLES, pgConfig, isLocalDatabase } = require("./content-tables.cjs");

const rootDir = path.resolve(__dirname, "..");
const inputDir = path.resolve(rootDir, process.env.CONTENT_EXPORT_DIR || CONTENT_EXPORT_DIR);
const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/wechurch_dev";

if (!isLocalDatabase(databaseUrl) && process.env.ALLOW_NON_LOCAL_IMPORT !== "1") {
  console.error("[content-import] Refusing to import into a non-local database.");
  console.error("[content-import] Set ALLOW_NON_LOCAL_IMPORT=1 only if you are absolutely sure.");
  process.exit(1);
}

function chunkRows(rows, size = 500) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function loadRows(table) {
  const file = path.join(inputDir, `${table.key}.json`);
  const payload = JSON.parse(await fs.readFile(file, "utf8"));
  if (!Array.isArray(payload.rows)) {
    throw new Error(`${path.relative(rootDir, file)} does not contain a rows array`);
  }
  return payload.rows;
}

async function insertRows(client, table, rows) {
  if (rows.length === 0) return;

  const dbColumns = table.columns.map(([, dbColumn]) => dbColumn);
  const jsonKeys = table.columns.map(([jsonKey]) => jsonKey);
  const columnSql = dbColumns.map(quoteIdentifier).join(", ");

  for (const chunk of chunkRows(rows)) {
    const values = [];
    const placeholders = chunk
      .map((row, rowIndex) => {
        const cells = jsonKeys.map((jsonKey, columnIndex) => {
          values.push(row[jsonKey] ?? null);
          return `$${rowIndex * jsonKeys.length + columnIndex + 1}`;
        });
        return `(${cells.join(", ")})`;
      })
      .join(", ");

    await client.query(`INSERT INTO ${quoteIdentifier(table.table)} (${columnSql}) VALUES ${placeholders}`, values);
  }
}

async function main() {
  const pool = new pg.Pool(pgConfig(databaseUrl));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `TRUNCATE TABLE ${TABLES.map((table) => quoteIdentifier(table.table)).join(", ")} RESTART IDENTITY`,
    );

    for (const table of TABLES) {
      const rows = await loadRows(table);
      await insertRows(client, table, rows);
      console.log(`[content-import] ${table.table}: ${rows.length} rows`);
    }

    await client.query("COMMIT");
    console.log("[content-import] import complete");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[content-import] failed:", error.message);
  process.exit(1);
});
