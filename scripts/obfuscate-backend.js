// Produces an obfuscated copy of backend/src for packaging into the installer.
// The real backend/src stays untouched and readable for development —
// only this generated copy (backend-obfuscated/src) ships to clients.
const fs = require('fs')
const path = require('path')
const JavaScriptObfuscator = require('javascript-obfuscator')

const SRC_DIR = path.join(__dirname, '..', 'backend', 'src')
const OUT_DIR = path.join(__dirname, '..', 'backend-obfuscated', 'src')

const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  splitStrings: true,
  splitStringsChunkLength: 6,
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const srcPath = path.join(dir, entry.name)
    const relPath = path.relative(SRC_DIR, srcPath)
    const outPath = path.join(OUT_DIR, relPath)

    if (entry.isDirectory()) {
      fs.mkdirSync(outPath, { recursive: true })
      walk(srcPath)
    } else if (entry.name.endsWith('.js') && entry.name !== 'wasm-data.js') {
      const code = fs.readFileSync(srcPath, 'utf8')
      const obfuscated = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS).getObfuscatedCode()
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, obfuscated)
    } else {
      // wasm-data.js (a base64-encoded WASM blob, not logic) and any non-JS files: copy as-is
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.copyFileSync(srcPath, outPath)
    }
  }
}

fs.rmSync(path.join(__dirname, '..', 'backend-obfuscated'), { recursive: true, force: true })
fs.mkdirSync(OUT_DIR, { recursive: true })
walk(SRC_DIR)
console.log('Backend obfuscated ->', OUT_DIR)
