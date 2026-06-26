const db = require('./db');
const fs = require('fs');
const path = require('path');

db.initialize().then(() => {
  const sql = fs.readFileSync(path.join(__dirname, 'migrate.sql'), 'utf8');
  db.exec(sql);
  console.log('Database migration completed successfully!');
}).catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
