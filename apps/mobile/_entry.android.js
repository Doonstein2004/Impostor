// Entry point shim para builds Android locales en monorepo pnpm.
// Expo CLI detecta el project root buscando package.json hacia arriba desde
// el entryFile. Al tener este archivo en apps/mobile/, Expo CLI usa apps/mobile
// como project root en lugar del root del monorepo (donde esta expo-router hoisted).
require('expo-router/entry');
