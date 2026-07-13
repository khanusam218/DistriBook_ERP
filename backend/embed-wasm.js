/**
 * Embeds sql-wasm.wasm as base64 so sql.js can initialize without external files.
 * Run: node embed-wasm.js
 */
const fs = require('fs');
const path = require('path');

const wasmPath = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);
const base64 = wasmBuffer.toString('base64');

const output = `// Auto-generated — sql.js WASM embedded as base64
module.exports = {
  wasmBase64: ${JSON.stringify(base64)},
  wasmBuffer: () => Buffer.from(${JSON.stringify(base64)}, 'base64'),
};
`;

fs.writeFileSync(path.join(__dirname, 'src', 'db', 'wasm-data.js'), output);
console.log('✅ Embedded sql-wasm.wasm into src/db/wasm-data.js');
console.log(`   Size: ${(wasmBuffer.length / 1024 / 1024).toFixed(2)} MB`);
