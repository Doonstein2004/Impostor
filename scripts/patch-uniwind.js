/**
 * patch-uniwind.js
 *
 * Fixes three bugs in Uniwind 1.9.0 on Windows:
 *
 * BUG 1 — Missing createOrderedCSSStyleSheet files:
 *   The webResolver intercepts any import of `createOrderedCSSStyleSheet` from
 *   react-native-web and redirects to `uniwind/components/createOrderedCSSStyleSheet`,
 *   but those files don't ship with the package. Creates the three missing files as
 *   pass-throughs to react-native-web's original implementation.
 *
 * BUG 2 — Windows path separator in transformer (isCss check):
 *   The transformer checks if the current file is the CSS entry by comparing
 *   `path.join(process.cwd(), cssEntryFile) === path.join(projectRoot, filePath)`.
 *   On Windows, Metro passes `filePath` as an absolute path. `path.join(abs, abs)`
 *   concatenates incorrectly (e.g. "C:\root\C:\root\global.css"), so `isCss` is
 *   always false and global.css is never transformed → UniwindStore stays empty →
 *   all className styles are broken on native.
 *   Fix: replace `path.join` with `path.resolve` for these comparisons.
 *
 * BUG 3 — Windows path separator in transformer (metro-injected check):
 *   The transformer checks `filePath.endsWith("/components/web/metro-injected.js")`
 *   using a forward-slash literal. On Windows, filePath uses backslashes, so this
 *   check is always false and metro-injected.js is never replaced with the reinit call.
 *   Fix: normalize separators before the endsWith check.
 *
 * Run automatically via the `postinstall` script in the root package.json.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UNIWIND = path.join(ROOT, 'node_modules', 'uniwind');

if (!fs.existsSync(UNIWIND)) {
  console.log('[patch-uniwind] uniwind not found, skipping.');
  process.exit(0);
}

// ─── BUG 1: Missing createOrderedCSSStyleSheet files ─────────────────────────

const NATIVE_DIR = path.join(UNIWIND, 'src', 'components', 'native');
const ESM_DIR = path.join(UNIWIND, 'dist', 'module', 'components', 'web');
const CJS_DIR = path.join(UNIWIND, 'dist', 'common', 'components', 'web');

const NATIVE_FILE = path.join(NATIVE_DIR, 'createOrderedCSSStyleSheet.tsx');
const ESM_FILE = path.join(ESM_DIR, 'createOrderedCSSStyleSheet.js');
const CJS_FILE = path.join(CJS_DIR, 'createOrderedCSSStyleSheet.js');

const NATIVE_CONTENT = `// Patch: Uniwind 1.9.0 missing file. Re-exports react-native-web's implementation.
export { default } from 'react-native-web/dist/exports/StyleSheet/dom/createOrderedCSSStyleSheet';
`;

const ESM_CONTENT = `// Patch: Uniwind 1.9.0 missing file. Re-exports react-native-web's implementation.
export { default } from 'react-native-web/dist/exports/StyleSheet/dom/createOrderedCSSStyleSheet';
`;

const CJS_CONTENT = `'use strict';
// Patch: Uniwind 1.9.0 missing file. Re-exports react-native-web's implementation.
Object.defineProperty(exports, '__esModule', { value: true });
const rnwMod = require('react-native-web/dist/exports/StyleSheet/dom/createOrderedCSSStyleSheet');
exports.default = rnwMod.default;
`;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeIfMissing(file, content) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, Buffer.from(content, 'utf8'));
    console.log(`[patch-uniwind] created ${path.relative(ROOT, file)}`);
  }
}

// ─── BUG 2 & 3: Windows path bugs in the Metro transformer ───────────────────

function patchTransformer() {
  const transformerPath = path.join(UNIWIND, 'dist', 'metro', 'transformer.cjs');
  if (!fs.existsSync(transformerPath)) {
    console.log('[patch-uniwind] transformer.cjs not found, skipping transformer patch.');
    return;
  }

  let src = fs.readFileSync(transformerPath, 'utf8');
  let changed = false;

  // BUG 2: `path.join(process.cwd(), ...)  ===  path.join(projectRoot, filePath)`
  // path.join with two absolute paths on Windows concatenates them incorrectly.
  // path.resolve correctly handles the case where filePath is already absolute.
  const OLD_ISCSS = 'path__default.join(process.cwd(), config$1.uniwind.cssEntryFile) === path__default.join(projectRoot, filePath)';
  const NEW_ISCSS = 'path__default.resolve(process.cwd(), config$1.uniwind.cssEntryFile) === path__default.resolve(projectRoot, filePath)';
  if (src.includes(OLD_ISCSS)) {
    src = src.replace(OLD_ISCSS, NEW_ISCSS);
    changed = true;
    console.log('[patch-uniwind] fixed isCss path.join → path.resolve (Bug 2)');
  } else if (!src.includes(NEW_ISCSS)) {
    console.log('[patch-uniwind] WARNING: isCss pattern not found, transformer may have changed.');
  }

  // BUG 3: `filePath.endsWith("/components/web/metro-injected.js")`
  // On Windows, filePath uses backslashes so the forward-slash literal never matches.
  const OLD_ENDS = 'if (filePath.endsWith("/components/web/metro-injected.js"))';
  const NEW_ENDS = 'if (filePath.replace(/\\\\/g, "/").endsWith("/components/web/metro-injected.js"))';
  if (src.includes(OLD_ENDS)) {
    src = src.replace(OLD_ENDS, NEW_ENDS);
    changed = true;
    console.log('[patch-uniwind] fixed metro-injected endsWith slash (Bug 3)');
  } else if (!src.includes(NEW_ENDS)) {
    console.log('[patch-uniwind] WARNING: metro-injected pattern not found, transformer may have changed.');
  }

  if (changed) {
    fs.writeFileSync(transformerPath, Buffer.from(src, 'utf8'));
  }
}

// ─── BUG 0: UTF-8 BOM in package.json ────────────────────────────────────────

function fixPackageJsonBOM() {
  const pkgPath = path.join(UNIWIND, 'package.json');
  const bytes = fs.readFileSync(pkgPath);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    fs.writeFileSync(pkgPath, bytes.slice(3));
    console.log('[patch-uniwind] removed BOM from uniwind/package.json');
  }
}

// ─── BUG 4: UTF-8 BOM in source CSS files (Lightning CSS SyntaxError) ────────

function patchReadFileSafe() {
  const distDir = path.join(UNIWIND, 'dist');
  if (!fs.existsSync(distDir)) {
    console.log('[patch-uniwind] dist directory not found, skipping readFileSafe patch.');
    return;
  }

  function walk(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith('.js') || file.endsWith('.cjs') || file.endsWith('.mjs')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let changed = false;

        const oldCJS1 = 'return fs__default.readFileSync(filePath, "utf-8");';
        const newCJS1 = 'const c = fs__default.readFileSync(filePath, "utf-8"); return c.charCodeAt(0) === 0xFEFF ? c.slice(1) : c;';

        const oldCJS2 = 'return _fs.default.readFileSync(filePath, "utf-8");';
        const newCJS2 = 'const c = _fs.default.readFileSync(filePath, "utf-8"); return c.charCodeAt(0) === 0xFEFF ? c.slice(1) : c;';

        if (content.includes(oldCJS1)) {
          content = content.replace(oldCJS1, newCJS1);
          changed = true;
        }
        if (content.includes(oldCJS2)) {
          content = content.replace(oldCJS2, newCJS2);
          changed = true;
        }

        if (changed) {
          fs.writeFileSync(fullPath, Buffer.from(content, 'utf8'));
          console.log(`[patch-uniwind] patched readFileSafe in ${path.relative(ROOT, fullPath)}`);
        }
      }
    });
  }

  walk(distDir);
}

// ─── BUG 5: Cascade Layers in Web (Tailwind v4 override by React Native Web) ──

function patchCompileWebCSS() {
  const distDir = path.join(UNIWIND, 'dist');
  if (!fs.existsSync(distDir)) return;

  const FLATTEN_FN = `
function flattenCSSLayers(css) {
  let result = '';
  let i = 0;
  while (i < css.length) {
    const nextLayer = css.slice(i).match(/@layer\\s+[\\w-]+\\s*\\{/);
    if (!nextLayer) {
      result += css.slice(i);
      break;
    }
    const layerStartRelative = nextLayer.index;
    const matchLength = nextLayer[0].length;
    const layerStartAbsolute = i + layerStartRelative;
    result += css.slice(i, layerStartAbsolute);
    let braceCount = 1;
    let j = layerStartAbsolute + matchLength;
    const contentStart = j;
    while (braceCount > 0 && j < css.length) {
      if (css[j] === '{') braceCount++;
      else if (css[j] === '}') braceCount--;
      j++;
    }
    if (braceCount === 0) {
      const contentEnd = j - 1;
      const layerContent = css.slice(contentStart, contentEnd);
      result += flattenCSSLayers(layerContent);
      i = j;
    } else {
      result += css.slice(layerStartAbsolute);
      break;
    }
  }
  return result;
}
`;

  function walk(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith('.js') || file.endsWith('.cjs') || file.endsWith('.mjs')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let changed = false;

        const old1 = 'return lightningcss.transform({\n    code: Buffer.from(tailwindCSS),\n    filename: "uniwind.css",\n    visitor: bundlerConfig.cssVisitor\n  }).code.toString();';
        const new1 = 'return flattenCSSLayers(lightningcss.transform({\n    code: Buffer.from(tailwindCSS),\n    filename: "uniwind.css",\n    visitor: bundlerConfig.cssVisitor\n  }).code.toString());';

        const old2 = 'return (0, _lightningcss.transform)({\n    code: Buffer.from(tailwindCSS),\n    filename: "uniwind.css",\n    visitor: bundlerConfig.cssVisitor\n  }).code.toString();';
        const new2 = 'return flattenCSSLayers((0, _lightningcss.transform)({\n    code: Buffer.from(tailwindCSS),\n    filename: "uniwind.css",\n    visitor: bundlerConfig.cssVisitor\n  }).code.toString());';

        const old3 = 'return transform$1({\n    code: Buffer.from(tailwindCSS),\n    filename: "uniwind.css",\n    visitor: bundlerConfig.cssVisitor\n  }).code.toString();';
        const new3 = 'return flattenCSSLayers(transform$1({\n    code: Buffer.from(tailwindCSS),\n    filename: "uniwind.css",\n    visitor: bundlerConfig.cssVisitor\n  }).code.toString());';

        const old4 = 'return transform({\n    code: Buffer.from(tailwindCSS),\n    filename: "uniwind.css",\n    visitor: bundlerConfig.cssVisitor\n  }).code.toString();';
        const new4 = 'return flattenCSSLayers(transform({\n    code: Buffer.from(tailwindCSS),\n    filename: "uniwind.css",\n    visitor: bundlerConfig.cssVisitor\n  }).code.toString());';

        if (content.includes(old1)) { content = content.replace(old1, new1); changed = true; }
        if (content.includes(old2)) { content = content.replace(old2, new2); changed = true; }
        if (content.includes(old3)) { content = content.replace(old3, new3); changed = true; }
        if (content.includes(old4)) { content = content.replace(old4, new4); changed = true; }

        if (changed) {
          content += FLATTEN_FN;
          fs.writeFileSync(fullPath, Buffer.from(content, 'utf8'));
          console.log(`[patch-uniwind] flattened css layers in ${path.relative(ROOT, fullPath)}`);
        }
      }
    });
  }

  walk(distDir);
}

// ─── Run all patches ─────────────────────────────────────────────────────────

fixPackageJsonBOM();

ensureDir(NATIVE_DIR);
ensureDir(ESM_DIR);
ensureDir(CJS_DIR);

writeIfMissing(NATIVE_FILE, NATIVE_CONTENT);
writeIfMissing(ESM_FILE, ESM_CONTENT);
writeIfMissing(CJS_FILE, CJS_CONTENT);

patchTransformer();
patchReadFileSafe();
patchCompileWebCSS();

console.log('[patch-uniwind] done.');


