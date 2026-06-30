// Metro configurado para monorepo (pnpm) + Uniwind (Tailwind 4).
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');
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

// 5. NO sobreescribimos unstable_conditionNames: Metro usa defaults por plataforma.
//    - Web:    ['browser', 'require', 'import', 'default'] → unifire web ✅, convex CJS ✅
//    - Native: ['react-native', 'require', 'default']      → unifire native ✅, convex CJS ✅
//    Nota histórica: hubo un error "Cannot use 'import.meta'" de Convex que se intentó
//    resolver con conditionNames = ['require', 'react-native', 'browser'], pero eso rompe
//    la resolución de los componentes web de Unifire (todos quedan con fuente nativa en web).
//    Con unstable_enablePackageExports = true (ya seteado), Convex elige CJS vía 'require'
//    sin necesitar un override de conditionNames.

// Unifire's transformer computes cssPath as path.join(process.cwd(), cssEntryFile).
// When Metro runs from the monorepo root (pnpm dev / turbo), process.cwd() != projectRoot,
// so './global.css' would resolve to the wrong location and the CSS transformation would
// silently skip, leaving UniwindStore empty and all className styles broken on native.
// Fix: compute a CWD-relative path that always resolves to the correct absolute file.
const cssAbsPath = path.resolve(projectRoot, 'global.css');
const dtsAbsPath = path.resolve(projectRoot, 'src/uniwind-types.d.ts');

// withUniwindConfig debe ser el wrapper más externo (requerimiento de Uniwind).
module.exports = withUniwindConfig(config, {
  cssEntryFile: path.relative(process.cwd(), cssAbsPath),
  dtsFile: path.relative(process.cwd(), dtsAbsPath),
});
