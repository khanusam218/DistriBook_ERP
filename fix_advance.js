const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname);
const dbFiles = fs.readdirSync(DB_DIR).filter(f => f.endsWith('.db'));

async function main() {
  const SQL = await initSqlJs();

  for (const file of dbFiles) {
    const filePath = path.join(DB_DIR, file);
    const buf = fs.readFileSync(filePath);
    const db = new SQL.Database(buf);

    // Check for employees
    try {
      const empRes = db.exec("SELECT id, name FROM employees");
      if (empRes.length === 0) continue;
      const employees = empRes[0].values;
      console.log(`\n=== ${file} ===`);
      console.log('Employees:', employees.map(r => `${r[0]}:${r[1]}`).join(', '));

      // Check ledger entries
      const ledgerRes = db.exec("SELECT id, employee_id, transaction_type, debit, credit, balance, description FROM employee_ledger ORDER BY id");
      if (ledgerRes.length > 0) {
        console.log('Ledger entries:');
        for (const row of ledgerRes[0].values) {
          console.log(`  id=${row[0]} emp=${row[1]} type=${row[2]} debit=${row[3]} credit=${row[4]} balance=${row[5]} desc=${row[6]}`);
        }
      } else {
        console.log('No ledger entries');
      }

      // Fix ADVANCE entries that still have debit > 0
      const badAdvances = db.exec("SELECT id, employee_id, debit FROM employee_ledger WHERE transaction_type = 'ADVANCE' AND debit > 0 AND credit = 0");
      if (badAdvances.length > 0 && badAdvances[0].values.length > 0) {
        console.log(`Fixing ${badAdvances[0].values.length} ADVANCE entries in ${file}...`);
        for (const row of badAdvances[0].values) {
          const [id, empId, debit] = row;
          db.run(`UPDATE employee_ledger SET debit = 0, credit = ? WHERE id = ?`, [debit, id]);
        }

        // Recalculate balances per employee
        const empIds = [...new Set(badAdvances[0].values.map(r => r[1]))];
        for (const empId of empIds) {
          const entries = db.exec(`SELECT id, debit, credit FROM employee_ledger WHERE employee_id = ? ORDER BY date ASC, id ASC`, [empId]);
          if (entries.length > 0) {
            let running = 0;
            for (const row of entries[0].values) {
              const [lid, debit, credit] = row;
              running = Math.round((running + debit - credit) * 100) / 100;
              db.run(`UPDATE employee_ledger SET balance = ? WHERE id = ?`, [running, lid]);
            }
          }
        }

        // Save
        const data = db.export();
        fs.writeFileSync(filePath, Buffer.from(data));
        console.log(`Saved ${file}`);
      } else {
        console.log('No ADVANCE fixes needed');
      }
    } catch (e) {
      // no employees table
    }
    db.close();
  }
}

main().catch(console.error);
