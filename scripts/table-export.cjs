#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const pg = require("pg");
const { pgConfig } = require("./content-tables.cjs");

const rootDir = path.resolve(__dirname, "..");
const configPath = process.env.TABLE_EXPORT_CONFIG;
const outputDirName = process.env.TABLE_EXPORT_DIR;
const databaseUrl = process.env.DATABASE_URL;

if (!configPath || !outputDirName) {
  console.error("[table-export] TABLE_EXPORT_CONFIG and TABLE_EXPORT_DIR are required.");
  process.exit(1);
}

if (!databaseUrl) {
  console.error("[table-export] DATABASE_URL is required.");
  process.exit(1);
}

const { TABLES } = require(path.resolve(rootDir, configPath));
const outputDir = path.resolve(rootDir, outputDirName);

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const pool = new pg.Pool(pgConfig(databaseUrl));
  const exportedAt = new Date().toISOString();
  const manifest = { exportedAt, tables: [] };

  try {
    for (const table of TABLES) {
      const sql = `SELECT * FROM ${quoteIdentifier(table.table)} ORDER BY ${table.orderBy || "1"}`;
      const { rows } = await pool.query(sql);
      const payload = { exportedAt, table: table.table, count: rows.length, rows };
      const fileName = `${table.table}.json`;
      await fs.writeFile(path.join(outputDir, fileName), `${JSON.stringify(payload, null, 2)}\n`);
      manifest.tables.push({ table: table.table, count: rows.length, file: fileName });
      console.log(`[table-export] ${table.table}: ${rows.length} rows`);
    }

    await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`[table-export] wrote ${path.relative(rootDir, outputDir)}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[table-export] failed:", error.message);
  process.exit(1);
});
