const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function main() {
  const SQL = await initSqlJs();
  const filePath = path.join(__dirname, '..', 'thok_biz_16.db');
  const buf = fs.readFileSync(filePath);
  const db = new SQL.Database(buf);

  console.log('=== Employees ===');
  const emps = db.exec("SELECT id, name FROM employees");
  if (emps.length) emps[0].values.forEach(r => console.log(r[0], r[1]));

  console.log('\n=== Employee Ledger (all) ===');
  const led = db.exec("SELECT id, employee_id, transaction_type, debit, credit, balance, description FROM employee_ledger ORDER BY id");
  if (led.length) led[0].values.forEach(r => console.log(`id=${r[0]} emp=${r[1]} type=${r[2]} debit=${r[3]} credit=${r[4]} balance=${r[5]} | ${r[6]}`));
  else console.log('empty');

  db.close();
}
main().catch(console.error);
