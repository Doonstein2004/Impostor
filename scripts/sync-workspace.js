#!/usr/bin/env node
// Sincroniza los paquetes del monorepo al node_modules de apps/mobile.
// Necesario en Windows porque pnpm usa hardlinks (no junctions) para workspace
// packages, así que los cambios en la fuente no se reflejan automáticamente.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MOBILE_NM = path.join(ROOT, 'apps', 'mobile', 'node_modules', '@impostor');

const PACKAGES = [
  {
    src: path.join(ROOT, 'packages', 'backend', 'convex'),
    dst: path.join(MOBILE_NM, 'backend', 'convex'),
    ext: ['.ts'],
  },
  {
    src: path.join(ROOT, 'packages', 'core', 'src'),
    dst: path.join(MOBILE_NM, 'core', 'src'),
    ext: ['.ts'],
  },
  {
    src: path.join(ROOT, 'packages', 'data', 'src'),
    dst: path.join(MOBILE_NM, 'data', 'src'),
    ext: ['.ts'],
  },
  {
    src: path.join(ROOT, 'packages', 'ui', 'src'),
    dst: path.join(MOBILE_NM, 'ui', 'src'),
    ext: ['.ts', '.tsx'],
  },
];

let synced = 0;
let skipped = 0;

for (const { src, dst, ext } of PACKAGES) {
  if (!fs.existsSync(src)) {
    console.warn(`  skip (not found): ${path.relative(ROOT, src)}`);
    continue;
  }
  if (!fs.existsSync(dst)) {
    console.warn(`  skip (no node_modules target): ${path.relative(ROOT, dst)}`);
    continue;
  }

  const files = fs.readdirSync(src).filter((f) => ext.some((e) => f.endsWith(e)));
  for (const file of files) {
    const srcFile = path.join(src, file);
    const dstFile = path.join(dst, file);

    if (!fs.existsSync(dstFile)) {
      skipped++;
      continue;
    }

    const srcMtime = fs.statSync(srcFile).mtimeMs;
    const dstMtime = fs.statSync(dstFile).mtimeMs;

    if (srcMtime > dstMtime) {
      fs.copyFileSync(srcFile, dstFile);
      console.log(`  synced: ${path.relative(ROOT, srcFile)}`);
      synced++;
    }
  }
}

if (synced === 0) {
  console.log('All workspace packages up to date.');
} else {
  console.log(`\nSynced ${synced} file(s). ${skipped > 0 ? `Skipped ${skipped} (no matching target).` : ''}`);
}
