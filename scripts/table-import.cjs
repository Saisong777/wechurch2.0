#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const pg = require("pg");
const { pgConfig, isLocalDatabase } = require("./content-tables.cjs");

const rootDir = path.resolve(__dirname, "..");
const configPath = process.env.TABLE_EXPORT_CONFIG;
const inputDirName = process.env.TABLE_EXPORT_DIR;
const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/wechurch_dev";

if (!configPath || !inputDirName) {
  console.error("[table-import] TABLE_EXPORT_CONFIG and TABLE_EXPORT_DIR are required.");
  process.exit(1);
}

if (!isLocalDatabase(databaseUrl) && process.env.ALLOW_NON_LOCAL_IMPORT !== "1") {
  console.error("[table-import] Refusing to import into a non-local database.");
  console.error("[table-import] Set ALLOW_NON_LOCAL_IMPORT=1 only if you are absolutely sure.");
  process.exit(1);
}

const { TABLES } = require(path.resolve(rootDir, configPath));
const inputDir = path.resolve(rootDir, inputDirName);

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function chunkRows(rows, size = 250) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

async function readRows(tableName) {
  const payload = JSON.parse(await fs.readFile(path.join(inputDir, `${tableName}.json`), "utf8"));
  if (!Array.isArray(payload.rows)) throw new Error(`${tableName}.json does not contain a rows array`);
  return payload.rows;
}

async function insertRows(client, tableName, rows) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const columnSql = columns.map(quoteIdentifier).join(", ");

  for (const chunk of chunkRows(rows)) {
    const values = [];
    const placeholders = chunk
      .map((row, rowIndex) => {
        const cells = columns.map((column, columnIndex) => {
          values.push(row[column] ?? null);
          return `$${rowIndex * columns.length + columnIndex + 1}`;
        });
        return `(${cells.join(", ")})`;
      })
      .join(", ");

    await client.query(`INSERT INTO ${quoteIdentifier(tableName)} (${columnSql}) VALUES ${placeholders}`, values);
  }
}

async function main() {
  const pool = new pg.Pool(pgConfig(databaseUrl));
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`TRUNCATE TABLE ${TABLES.map((table) => quoteIdentifier(table.table)).join(", ")} RESTART IDENTITY CASCADE`);

    for (const table of TABLES) {
      const rows = await readRows(table.table);
      await insertRows(client, table.table, rows);
      console.log(`[table-import] ${table.table}: ${rows.length} rows`);
    }

    await client.query("COMMIT");
    console.log("[table-import] import complete");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[table-import] failed:", error.message);
  process.exit(1);
});
