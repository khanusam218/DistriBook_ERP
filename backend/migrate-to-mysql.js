#!/usr/bin/env node
/**
 * One-off migration: copies data out of the legacy sql.js SQLite file
 * (`thok.db`, found at the repo root — the file that held the real
 * "Hafiz Luqman" admin account and business data from local testing) into
 * the new MySQL database.
 *
 * This is NOT run automatically on app startup — run it manually, once,
 * before switching the app over to MySQL in production:
 *
 *   cd backend
 *   npm install
 *   # Make sure backend/.env has DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD set
 *   node migrate-to-mysql.js
 *   # or: npm run migrate-to-mysql
 *
 * Safe to re-run: every insert uses INSERT IGNORE keyed on the original
 * SQLite row id, so running it twice just skips rows already migrated.
 *
 * What it does:
 *   1. Opens the legacy sql.js file(s) (thok.db, plus any thok_biz_<id>.db
 *      files sitting next to it — per-tenant files from the old file-per-
 *      tenant model, if any exist).
 *   2. Copies the `users` table as-is into MySQL (global/shared table).
 *   3. For thok.db specifically: its business tables belonged to whichever
 *      legacy user(s) had `business_owner_id IS NULL` (pre-multi-tenancy
 *      accounts sharing the auth db as their business db) — those rows are
 *      migrated with business_owner_id set to that user's own id (the same
 *      backfill rule the app itself applies going forward).
 *   4. For each thok_biz_<ownerId>.db found: its business tables are
 *      migrated with business_owner_id = ownerId directly.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { wasmBuffer } = require('./src/db/wasm-data');
const db = require('./src/db/db');

const REPO_ROOT = path.join(__dirname, '..'); // backend/.. == repo root (where thok.db lives)
const AUTH_DB_PATH = path.join(REPO_ROOT, 'thok.db');

function loadSqliteFile(SQL, filePath) {
  if (!fs.existsSync(filePath)) return null;
  return new SQL.Database(fs.readFileSync(filePath));
}

function tableExists(sqliteDb, table) {
  const res = sqliteDb.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`
  );
  return res.length > 0 && res[0].values.length > 0;
}

function readAllRows(sqliteDb, table) {
  if (!tableExists(sqliteDb, table)) return [];
  const res = sqliteDb.exec(`SELECT * FROM ${table}`);
  if (res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

async function insertUsers(rows) {
  let inserted = 0;
  for (const u of rows) {
    // Clear out any placeholder default-admin row with the same username
    // (db.initialize() seeds a 'hafizluqman' admin when the users table is
    // empty — if that ran before this script, it must not collide with the
    // real migrated account of the same name).
    await db.pool.execute('DELETE FROM users WHERE username = ? AND id != ?', [u.username, u.id]);
    const ownerId = u.business_owner_id ?? u.id;
    try {
      await db.pool.execute(
        `INSERT IGNORE INTO users
           (id, username, email, password, full_name, is_active, role, permissions, business_name, business_owner_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          u.id, u.username, u.email, u.password, u.full_name || '',
          u.is_active ?? 1, u.role || 'user', u.permissions || '{}',
          u.business_name || '', ownerId,
          u.created_at || new Date(), u.updated_at || new Date(),
        ]
      );
      inserted++;
    } catch (e) {
      console.error(`  ! Failed to insert user "${u.username}" (id ${u.id}):`, e.message);
    }
  }
  return inserted;
}

async function insertBusinessRows(table, rows, tenantId) {
  let inserted = 0;
  for (const row of rows) {
    const cols = Object.keys(row).filter(c => c !== 'business_owner_id');
    const values = cols.map(c => row[c]);
    const placeholders = cols.map(() => '?').join(', ');
    try {
      await db.pool.execute(
        `INSERT IGNORE INTO ${table} (${cols.join(', ')}, business_owner_id) VALUES (${placeholders}, ?)`,
        [...values, tenantId]
      );
      inserted++;
    } catch (e) {
      console.error(`  ! Failed to insert row into ${table} (id ${row.id}):`, e.message);
    }
  }
  return inserted;
}

async function migrateFile(SQL, filePath, tenantIdForFile, label) {
  const sqliteDb = loadSqliteFile(SQL, filePath);
  if (!sqliteDb) {
    console.log(`  (no file at ${filePath}, skipping)`);
    return;
  }
  console.log(`\n=== Migrating ${label} (${filePath}) → tenant #${tenantIdForFile} ===`);
  for (const table of db.TENANT_TABLES) {
    const rows = readAllRows(sqliteDb, table);
    if (rows.length === 0) continue;
    const n = await insertBusinessRows(table, rows, tenantIdForFile);
    console.log(`  ${table}: ${n}/${rows.length} rows migrated`);
  }
  sqliteDb.close();
}

async function main() {
  console.log('DistriBook ERP — legacy SQLite → MySQL migration');
  console.log('==================================================');

  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
    console.error('DB_HOST / DB_USER / DB_NAME env vars are required (see backend/.env). Aborting.');
    process.exit(1);
  }

  console.log('\nConnecting to MySQL and ensuring schema exists...');
  await db.initialize();

  const SQL = await initSqlJs({ wasmBinary: wasmBuffer() });

  if (!fs.existsSync(AUTH_DB_PATH)) {
    console.log(`\nNo legacy thok.db found at ${AUTH_DB_PATH} — nothing to migrate.`);
    process.exit(0);
  }

  const authSqliteDb = loadSqliteFile(SQL, AUTH_DB_PATH);
  const userRows = readAllRows(authSqliteDb, 'users');
  console.log(`\nFound ${userRows.length} user(s) in thok.db.`);
  const usersInserted = await insertUsers(userRows);
  console.log(`  users: ${usersInserted}/${userRows.length} rows migrated`);

  // thok.db's own business tables belong to whichever legacy (business_owner_id
  // IS NULL) user(s) it served. If there's more than one such user, they all
  // shared the exact same data in the old model — migrate it under the first
  // (lowest id) legacy user, since the app's own backfill rule assigns each
  // legacy user business_owner_id = their own id going forward, and that's
  // also the account that will actually be logging in and using this data.
  const legacyUsers = userRows.filter(u => u.business_owner_id == null);
  if (legacyUsers.length > 0) {
    const primaryLegacyId = Math.min(...legacyUsers.map(u => u.id));
    await migrateFile(SQL, AUTH_DB_PATH, primaryLegacyId, 'thok.db business data');
  } else {
    console.log('\nNo legacy (business_owner_id IS NULL) users found — skipping thok.db business data.');
  }
  authSqliteDb.close();

  // Per-tenant files from the old file-per-tenant model, if any exist next to thok.db.
  const dirEntries = fs.readdirSync(REPO_ROOT).filter(f => /^thok_biz_\d+\.db$/.test(f));
  for (const entry of dirEntries) {
    const ownerId = Number(entry.match(/^thok_biz_(\d+)\.db$/)[1]);
    await migrateFile(SQL, path.join(REPO_ROOT, entry), ownerId, entry);
  }

  console.log('\n==================================================');
  console.log('Migration complete.');
  process.exit(0);
}

main().catch(err => {
  console.error('\nMigration failed:', err);
  process.exit(1);
});
