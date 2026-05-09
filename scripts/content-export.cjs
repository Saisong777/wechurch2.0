#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const pg = require("pg");
const { CONTENT_EXPORT_DIR, TABLES, pgConfig } = require("./content-tables.cjs");

const rootDir = path.resolve(__dirname, "..");
const outputDir = path.resolve(rootDir, process.env.CONTENT_EXPORT_DIR || CONTENT_EXPORT_DIR);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[content-export] DATABASE_URL is required.");
  process.exit(1);
}

function selectList(table) {
  return table.columns.map(([jsonKey, dbColumn]) => `"${dbColumn}" AS "${jsonKey}"`).join(", ");
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const pool = new pg.Pool(pgConfig(databaseUrl));
  const manifest = {
    exportedAt: new Date().toISOString(),
    tables: [],
  };

  try {
    for (const table of TABLES) {
      const sql = `SELECT ${selectList(table)} FROM "${table.table}" ORDER BY ${table.orderBy}`;
      const { rows } = await pool.query(sql);
      const payload = {
        exportedAt: manifest.exportedAt,
        table: table.table,
        count: rows.length,
        rows,
      };
      const file = path.join(outputDir, `${table.key}.json`);
      await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`);
      manifest.tables.push({ key: table.key, table: table.table, count: rows.length, file: `${table.key}.json` });
      console.log(`[content-export] ${table.table}: ${rows.length} rows`);
    }

    await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`[content-export] wrote ${path.relative(rootDir, outputDir)}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[content-export] failed:", error.message);
  process.exit(1);
});
