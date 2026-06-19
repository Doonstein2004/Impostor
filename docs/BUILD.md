# Guía de Build y Pipelines

## Flujo local (sin cuenta Expo / EAS)

### 1. Desarrollo web
```bash
# Terminal 1: backend
pnpm convex:dev

# Terminal 2: app
pnpm --filter @impostor/mobile dev:clear
# Presioná 'w' → abre en http://localhost:8081
```

### 2. Prebuild Android local (requiere Android Studio + SDK)
El prebuild genera la carpeta `android/` a partir del `app.json` de Expo.
Solo necesitás hacerlo cuando cambiás plugins nativos.

```bash
# Desde la raíz del monorepo
pnpm --filter @impostor/mobile prebuild:android

# Después corré en Android Studio o con:
pnpm --filter @impostor/mobile android
```

> **Primera vez:** instalá Android Studio, configurá `ANDROID_HOME` y creá un
> emulador en AVD Manager. Ver https://docs.expo.dev/workflow/android-studio-emulator/

### 3. Prebuild iOS local (requiere macOS + Xcode)
```bash
pnpm --filter @impostor/mobile prebuild:ios
pnpm --filter @impostor/mobile ios
```

---

## EAS Build (en la nube, sin Android Studio / Xcode local)

### Setup inicial (una vez)
```bash
npm install -g eas-cli          # instalar EAS CLI globalmente
eas login                       # login con tu cuenta Expo
eas build:configure             # genera / valida eas.json y app.json
```

### Perfiles disponibles (en `apps/mobile/eas.json`)

| Perfil | Uso | Distribución |
|--------|-----|--------------|
| `development` | Dev client para probar en dispositivo real | Internal (APK/Simulator) |
| `preview` | QA / testing interno | Internal (APK/IPA) |
| `production` | Release a tiendas | App Bundle (Android) / IPA (iOS) |

### Comandos rápidos
```bash
cd apps/mobile

# Build de desarrollo (APK para Android, Simulator para iOS)
npx eas build --profile development --platform android
npx eas build --profile development --platform ios

# Build de preview (para probar en dispositivos reales sin tienda)
npx eas build --profile preview --platform android

# Build de producción
npx eas build --profile production --platform all

# Submit a tiendas (después del build de producción)
npx eas submit --profile production
```

### Variables de entorno por perfil
En `eas.json`, cada perfil tiene su `EXPO_PUBLIC_CONVEX_URL`:
- `development` → Convex local (`127.0.0.1:3210`)
- `preview` → Deployment de preview en Convex Cloud
- `production` → Deployment de producción en Convex Cloud

Para crear deployments en la nube:
```bash
# En packages/backend:
npx convex deploy --prod   # crea/actualiza el deployment de producción
# Copiá la URL y actualizá eas.json y .env según el ambiente
```

---

## Desktop (Tauri v2)

### Requisitos
- Rust + cargo: https://www.rust-lang.org/tools/install
- En Windows: Visual Studio Build Tools con el workload "Desktop development with C++"

```bash
# Dev (abre ventana nativa + hot reload)
pnpm --filter @impostor/desktop dev

# Build de distribución (genera .msi, .dmg o .AppImage según OS)
pnpm --filter @impostor/desktop build
# El binario queda en apps/desktop/src-tauri/target/release/bundle/
```

---

## CI/CD con GitHub Actions (estructura sugerida)

```yaml
# .github/workflows/eas-build.yml
name: EAS Build
on:
  push:
    branches: [main]
    paths:
      - 'apps/mobile/**'
      - 'packages/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: pnpm --filter @impostor/mobile eas:preview:android
        env:
          EXPO_PUBLIC_CONVEX_URL: ${{ secrets.CONVEX_PREVIEW_URL }}
```

---

## Checklist antes de subir a tiendas

- [ ] `bundleIdentifier` (iOS) y `package` (Android) únicos en `app.json`
- [ ] Íconos en `apps/mobile/assets/` (1024×1024 PNG para iOS, 512×512 para Android)
- [ ] Splash screen en `assets/`
- [ ] `EXPO_PUBLIC_CONVEX_URL` apuntando al deployment de producción
- [ ] Versión incrementada en `app.json` y `package.json`
- [ ] Privacy policy URL en app.json (requerido por App Store)
- [ ] Google Service Account configurado para submit automático (Android)
