// Metro configurado para monorepo (pnpm) + NativeWind.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Observar todo el monorepo para que los cambios en packages/* recarguen,
//    pero excluir los artefactos de Rust (Cargo genera miles de archivos temporales
//    ahí y Metro intenta vigilarlos causando crashes ENOENT).
config.watchFolders = [workspaceRoot];
config.resolver.blockList = [
  /apps[/\\]desktop[/\\]src-tauri[/\\]target[/\\].*/,
];

// 2. Resolver módulos desde la app y desde la raíz del workspace.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Evitar duplicar React/React Native entre paquetes.
config.resolver.disableHierarchicalLookup = false;

// 4. Honrar el campo "exports" de package.json (subpaths como @impostor/backend/api,
//    que apunta a convex/_generated). Necesario para resolver la API tipada de Convex.
config.resolver.unstable_enablePackageExports = true;

// 5. Priorizar la build CJS sobre la ESM. Sin esto, Metro elige la variante ESM de
//    `convex` que usa `import.meta` y rompe en web ("Cannot use 'import.meta'").
//    'default' siempre matchea como fallback, así que los subpaths siguen resolviendo.
config.resolver.unstable_conditionNames = ['require', 'react-native', 'browser'];

module.exports = withNativeWind(config, { input: './global.css' });
