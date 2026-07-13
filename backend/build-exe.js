/**
 * Build script: bundles backend + copies assets for .exe packaging.
 * Run: node build-exe.js
 */
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, 'dist');

// Clean dist
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 1. Bundle backend into single JS file (minified + obfuscated for protection)
console.log('[1/4] Bundling backend code...');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'src', 'server.js')],
  bundle: true,
  minify: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  minifyWhitespace: true,
  platform: 'node',
  target: 'node22',
  outfile: path.join(DIST_DIR, 'server.bundle.js'),
  external: [], // bundle everything
  loader: { '.node': 'file' },
});

// 2. Copy sql.js WASM file (needed at runtime)
console.log('[2/4] Copying sql.js WASM...');
const wasmSrc = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const wasmDst = path.join(DIST_DIR, 'sql-wasm.wasm');
fs.copyFileSync(wasmSrc, wasmDst);

// 3. Copy public/ frontend build
console.log('[3/4] Copying frontend build (public/)...');
const publicSrc = path.join(__dirname, '..', 'public');
const publicDst = path.join(DIST_DIR, 'public');
copyDirSync(publicSrc, publicDst);

// 4. Create minimal package.json for pkg
console.log('[4/4] Creating package.json for pkg...');
const pkgJson = {
  name: 'thok-software',
  version: '1.0.0',
  bin: 'server.bundle.js',
  pkg: {
    assets: [
      'public/**/*',
      'sql-wasm.wasm',
    ],
    targets: ['node22-win-x64'],
    outputPath: '..',
  },
};
fs.writeFileSync(path.join(DIST_DIR, 'package.json'), JSON.stringify(pkgJson, null, 2));

console.log('✅ Build complete! dist/ is ready for pkg packaging.');
console.log('   Next: cd dist && npm install --save-dev @yao-pkg/pkg && npx pkg .');

// ── Helper ──
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
