/**
 * First-time setup script.
 * Run once on a fresh install: node setup.js
 * Creates an admin account so you can log in.
 */
const initSqlJs = require('./backend/node_modules/sql.js')
const bcrypt    = require('./backend/node_modules/bcryptjs')
const fs        = require('fs')
const path      = require('path')
const readline  = require('readline')

const DB_PATH = path.join(__dirname, 'thok.db')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise(res => rl.question(q, res))

async function main() {
  console.log('\n=== DistriBook ERP — First-Time Setup ===\n')

  const username  = await ask('Enter admin username  [admin]: ') || 'admin'
  const password  = await ask('Enter admin password  [admin123]: ') || 'admin123'
  const fullName  = await ask('Enter full name       [Administrator]: ') || 'Administrator'
  const email     = await ask('Enter email           [admin@thok.com]: ') || 'admin@thok.com'
  rl.close()

  const SQL = await initSqlJs()
  const dbExists = fs.existsSync(DB_PATH)
  const sqliteDb = dbExists ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database()

  // Create users table
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    role TEXT DEFAULT 'admin',
    permissions TEXT DEFAULT '{}',
    business_name TEXT DEFAULT '',
    business_owner_id INTEGER DEFAULT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`)

  // Check if username already exists
  const stmt = sqliteDb.prepare('SELECT id FROM users WHERE username = ?')
  stmt.bind([username])
  const exists = stmt.step()
  stmt.free()

  if (exists) {
    console.log(`\n⚠  User "${username}" already exists. Setup skipped.`)
    console.log('   If you forgot your password, run: node setup.js again with a different username.\n')
    process.exit(0)
  }

  const hash = bcrypt.hashSync(password, 10)
  sqliteDb.run(
    `INSERT INTO users (username, email, password, full_name, role) VALUES (?, ?, ?, ?, 'admin')`,
    [username, email, hash, fullName]
  )

  const data = sqliteDb.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))

  console.log('\n✅ Admin account created successfully!')
  console.log(`   Username : ${username}`)
  console.log(`   Password : ${password}`)
  console.log('\n   Now run START.bat to launch the software.\n')
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
