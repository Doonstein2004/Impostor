# Impostor Fútbol — Guía de Desarrollo

Juego multijugador de deducción social temático de fútbol. Jugadores reciben un personaje secreto (jugador o DT) y deben dar pistas sin revelar su identidad. Los impostores no saben el personaje y deben disimular. Al detectar al impostor, este tiene una última oportunidad de adivinar el personaje para ganar.

---

## Índice

1. [Arquitectura](#arquitectura)
2. [Prerequisitos](#prerequisitos)
3. [Instalación inicial](#instalación-inicial)
4. [Variables de entorno](#variables-de-entorno)
5. [Entornos de desarrollo](#entornos-de-desarrollo)
6. [Compilar para producción](#compilar-para-producción)
7. [Mecánicas del juego](#mecánicas-del-juego)
8. [Estructura del monorepo](#estructura-del-monorepo)

---

## Arquitectura

| Capa | Tecnología |
|------|-----------|
| Frontend | Expo SDK 52 + Expo Router, React Native 0.76 |
| Estilos | NativeWind v4.1.23 (Tailwind para RN) |
| Animaciones | react-native-reanimated v3.16 |
| Backend | Convex (base de datos reactiva + serverless functions) |
| Desktop | Tauri v2 (empaqueta la web build de Expo) |
| Monorepo | pnpm workspaces + Turborepo |
| Lenguaje | TypeScript estricto en todos los paquetes |

---

## Prerequisitos

### Obligatorios (todos los entornos)

| Herramienta | Versión mínima | Instalación |
|-------------|---------------|-------------|
| Node.js | 20.x LTS | https://nodejs.org |
| pnpm | 9.12.0 | `npm install -g pnpm@9.12.0` |
| Git | cualquiera | https://git-scm.com |

### Para Android

| Herramienta | Versión | Instalación |
|-------------|---------|-------------|
| Java JDK | **17** (no más nuevo) | Ver sección Java 17 abajo |
| Android Studio | última | https://developer.android.com/studio |

#### Instalar Java 17 con SDKMAN (Git Bash en Windows)

```bash
# Instalar SDKMAN (correr en Git Bash, no PowerShell)
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"

# Instalar Java 17 Temurin
sdk install java 17.0.11-tem
sdk default java 17.0.11-tem

# Verificar
java -version  # debe mostrar 17.0.11
```

Luego para builds Android, setear `JAVA_HOME` en PowerShell:

```powershell
$env:JAVA_HOME = "C:\Users\TU_USUARIO\.sdkman\candidates\java\17.0.11-tem"
```

### Para Desktop (Tauri)

| Herramienta | Instalación |
|-------------|-------------|
| Rust (stable) | `winget install Rustlang.Rustup` → `rustup install stable` |
| VS Build Tools | `winget install Microsoft.VisualStudio.2022.BuildTools` |
| WebView2 | Viene con Windows 11 / Edge |

```powershell
# Verificar Rust
rustc --version   # 1.77.2 o más nuevo
cargo --version
```

---

## Instalación inicial

```powershell
# Clonar y entrar al proyecto
git clone <repo>
cd Impostor

# Instalar todas las dependencias del monorepo
pnpm install

# Generar datos (personajes de fútbol)
pnpm data:generate
```

---

## Variables de entorno

### Backend — `packages/backend/.env.local`

```env
# Deployment usado por `npx convex dev`
CONVEX_DEPLOYMENT=dev:curious-sheep-977   # tu proyecto en Convex
CONVEX_URL=https://curious-sheep-977.convex.cloud
CONVEX_SITE_URL=https://curious-sheep-977.convex.site
```

> Este archivo lo genera automáticamente `npx convex dev` la primera vez.
> Para crear un proyecto nuevo: `cd packages/backend && npx convex dev`

### Mobile — `apps/mobile/.env`

```env
# URL del backend Convex (dev o prod)
EXPO_PUBLIC_CONVEX_URL=https://curious-sheep-977.convex.cloud
```

> Cambiar esta URL al deployment de producción para builds de release.

---

## Entornos de desarrollo

### Desarrollo completo (recomendado)

Abrir **dos terminales**:

**Terminal 1 — Backend Convex** (mantener corriendo siempre):
```powershell
pnpm convex:dev
# ✔ Convex functions ready! (dev:curious-sheep-977)
# Escucha cambios en packages/backend/convex/ y sincroniza al cloud
```

**Terminal 2 — App mobile**:
```powershell
pnpm mobile          # Inicia Metro + Expo (web + QR para móvil)
# o
pnpm --filter @impostor/mobile dev
```

Abre `http://localhost:8081` en el browser para ver la versión web.

Para ver en celular: instalar **Expo Go** y escanear el QR que aparece en la terminal.

---

### Solo web (más rápido para UI)

```powershell
pnpm convex:dev          # Terminal 1: backend
pnpm --filter @impostor/mobile web   # Terminal 2: solo web
```

---

### Android en dispositivo físico

**Prerrequisito**: USB debugging habilitado en el celular (Ajustes → Opciones de desarrollador → Depuración USB).

```powershell
# Setear Java 17 (PowerShell)
$env:JAVA_HOME = "C:\Users\TU_USUARIO\.sdkman\candidates\java\17.0.11-tem"

# Verificar que el dispositivo está conectado
adb devices   # debe mostrar el dispositivo

# Build + instalar en el dispositivo
pnpm --filter @impostor/mobile android

# El APK debug queda también en:
# apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

> El primer build tarda ~5 min (descarga Gradle). Los siguientes son más rápidos gracias al build cache.

---

### Android en emulador

1. Abrir Android Studio → Device Manager → crear AVD (API 34, arm64)
2. Iniciar el emulador
3. Correr `pnpm --filter @impostor/mobile android`

---

### Desktop (Tauri)

**Prerrequisito**: Rust instalado (ver sección prerequisitos).

```powershell
# Terminal 1: backend
pnpm convex:dev

# Terminal 2: app web (Tauri la consume)
pnpm --filter @impostor/mobile web

# Terminal 3: app desktop
pnpm desktop:dev
```

La ventana desktop se abre automáticamente apuntando a `http://localhost:8081`.

---

### Pruebas con múltiples jugadores en la misma red LAN

El backend ya está en la nube (`curious-sheep-977.convex.cloud`), así que no hace falta que estén en la misma red para el backend. Para la UI:

```powershell
# Exponer Metro en la red LAN
pnpm --filter @impostor/mobile dev --lan
# o
EXPO_PUBLIC_HOST=0.0.0.0 pnpm --filter @impostor/mobile web
```

Otros dispositivos en la misma WiFi pueden acceder a `http://TU-IP-LAN:8081`.

---

## Compilar para producción

### 1. Deploy del backend a producción

```powershell
cd packages\backend

# Deploy prod (crea un deployment separado y estable)
npx convex deploy --prod

# La URL de prod será algo como:
# https://curious-sheep-977.convex.cloud  (misma URL, deployment prod separado internamente)
```

Actualizar `apps/mobile/.env` si la URL de prod es diferente a la de dev.

---

### 2. Web — Deploy a Vercel

```powershell
# Instalar Vercel CLI (una sola vez)
npm install -g vercel

# Build + deploy en un paso
pnpm --filter @impostor/mobile build:web && vercel apps/mobile/dist --prod
```

El `vercel.json` en la raíz del repo ya configura el routing (clean URLs + rewrites para
rutas dinámicas) automáticamente.

**Re-deploy** (cuando haya cambios en el código):
```powershell
pnpm --filter @impostor/mobile build:web && vercel apps/mobile/dist --prod
```

> URL pública resultante: `https://impostor-black-one.vercel.app` (o la que Vercel asigne)

---

### 3. APK Android — Release

```powershell
# Generar carpeta android/ (si no existe)
pnpm --filter @impostor/mobile prebuild:android

# Build release (APK sin firma de producción)
$env:JAVA_HOME = "C:\Users\TU_USUARIO\.sdkman\candidates\java\17.0.11-tem"
cd apps\mobile\android
.\gradlew assembleRelease

# APK en:
# apps/mobile/android/app/build/outputs/apk/release/app-release-unsigned.apk
```

> Para Play Store necesitan firmar el APK. Usar `.\gradlew bundleRelease` para AAB.

**Alternativa con EAS (sin configurar keystore manualmente)**:
```powershell
# Instalar EAS CLI
npm install -g eas-cli

# Build local (usa tu máquina, no consume minutos cloud)
eas build --platform android --local
```

---

### 4. Desktop — Instalador Tauri

```powershell
# Build web primero
pnpm --filter @impostor/mobile build:web

# Compilar instalador desktop
pnpm desktop:build

# Instalador en:
# apps/desktop/src-tauri/target/release/bundle/
#   ├── msi/    → Windows installer
#   ├── nsis/   → Windows setup
#   └── ...
```

> El primer build tarda ~10 min (compila Rust + empaqueta).

---

## Mecánicas del juego

### Flujo de una partida

```
Lobby → Reparto de cartas → Vueltas de pistas → Votación → [Adivinanza del impostor] → Reveal → Lobby
```

1. **Lobby**: el host configura la partida, jugadores se unen con el código de sala
2. **Reparto**: cada jugador recibe en secreto su personaje. El impostor recibe `nada`, `pista` (zona/época) o un personaje `similar` según la config
3. **Vueltas de pistas**: los jugadores dan una pista por turno en orden aleatorio. El timer de turno auto-salta al siguiente jugador si vence
4. **Votación**: todos votan quién creen que es el impostor. Hay un timer configurable
5. **Adivinanza**: si votan al impostor, este tiene una última oportunidad de adivinar el personaje secreto
   - Acierta → el impostor gana 2 puntos
   - Falla → los inocentes ganan 1 punto cada uno
   - Si no votaron al impostor → el impostor gana 2 puntos directamente
6. **Reveal**: se muestra el resultado, los roles y el ranking de la sesión

### Configuración disponible (Lobby → tabs)

**Partida**
- Rondas por sesión (1, 2, 3, 5, ∞)
- Vueltas de pistas por partida (1, 2, 3, 5, ∞) — automáticas
- Cantidad de impostores (1, 2, 3)

**Jugadores (Pool)**
- Posición: Portero, Defensor, Medio, Atacante (vacío = todas)
- Época: Antiguo, Leyenda, Moderno, Experimentado, Actual, Joven Promesa (vacío = todas)
- Tipo: Jugador / DT

**Reglas**
- Segundos por turno de pista (15s, 30s, 60s, ∞, o personalizado)
- Tiempo de votación (30s, 60s, 90s, ∞, o personalizado)
- El impostor recibe: Nada / Pista (zona+época) / Personaje Similar

### Puntuación
- Inocentes detectan al impostor y este falla la adivinanza → **+1 punto cada inocente**
- Impostor detectado adivina el personaje → **+2 puntos al impostor**
- Impostor no es detectado (escapa) → **+2 puntos al impostor**
- Al terminar la sesión (N rondas), se muestra el ganador y se puede iniciar nueva sesión (resetea scores)

### Sin repetición de personajes
Los personajes usados en rondas anteriores de la misma sesión se excluyen automáticamente. Si se agotan todos los del pool configurado, el sistema los reinicia y vuelve a mezclar.

---

## Estructura del monorepo

```
Impostor/
├── apps/
│   ├── mobile/              # App principal (Expo)
│   │   ├── app/             # Rutas (Expo Router)
│   │   │   ├── index.tsx    # Pantalla de inicio (crear/unirse a sala)
│   │   │   └── room/[code].tsx  # Router de sala → Lobby/GameRound/Voting/Reveal
│   │   ├── src/
│   │   │   ├── components/  # Componentes de pantalla
│   │   │   │   ├── Lobby.tsx          # Sala de espera + configuración
│   │   │   │   ├── GameRound.tsx      # Turno de pistas + temporizador
│   │   │   │   ├── Voting.tsx         # Pantalla de votación
│   │   │   │   ├── ImpostorGuess.tsx  # Adivinanza del impostor detectado
│   │   │   │   ├── Reveal.tsx         # Resultado + ranking
│   │   │   │   └── types.ts           # Tipos compartidos (RoomView, etc.)
│   │   │   └── lib/
│   │   │       ├── session.ts     # clientId + nombre del jugador (AsyncStorage)
│   │   │       └── useCountdown.ts  # Hook de temporizador animado
│   │   ├── global.css       # Tailwind base
│   │   ├── metro.config.js  # Configuración Metro (monorepo + bloqueo Rust artifacts)
│   │   └── .env             # EXPO_PUBLIC_CONVEX_URL
│   │
│   └── desktop/             # App desktop (Tauri v2)
│       └── src-tauri/
│           ├── tauri.conf.json  # Config: ventana 480×860, apunta a mobile/dist
│           └── Cargo.toml
│
├── packages/
│   ├── backend/             # Convex backend
│   │   └── convex/
│   │       ├── schema.ts    # Tablas: rooms, players, rounds, assignments, clues, reactions, votes
│   │       ├── game.ts      # Mutations: startRound, submitClueAndAdvance, reveal, submitImpostorGuess, ...
│   │       ├── rooms.ts     # Mutations: create, join, leave, updateConfig
│   │       ├── votes.ts     # Mutations: cast; Queries: state
│   │       └── clues.ts     # Queries: listByRound (con reactionCounts)
│   │
│   ├── core/                # Lógica de negocio pura (sin dependencias de plataforma)
│   │   └── src/
│   │       ├── types.ts     # GameConfig, Character, RoomStatus, DEFAULT_CONFIG
│   │       ├── game.ts      # filterPool, setupRound, tallyVotes, generateRoomCode
│   │       ├── categories.ts  # Zone, Era, Role + labels
│   │       └── game.test.ts   # Tests con Vitest
│   │
│   ├── data/                # Dataset de personajes de fútbol
│   │   └── src/
│   │       └── characters.ts  # ~200+ jugadores y DTs con zona/época/rol/club
│   │
│   └── ui/                  # Componentes base (Button, Card, Screen, Text)
│       └── src/
│           └── components/
│
├── pnpm-workspace.yaml      # Define los workspaces
├── turbo.json               # Pipeline de Turborepo (build, typecheck, lint)
├── package.json             # Scripts raíz
└── DESARROLLO.md            # Este archivo
```

---

## Scripts disponibles

```powershell
# Desde la raíz del monorepo:

pnpm convex:dev          # Iniciar backend Convex (dev cloud)
pnpm mobile              # Iniciar app mobile (Expo)
pnpm desktop:dev         # Iniciar app desktop (Tauri + web)
pnpm desktop:build       # Compilar instalador desktop
pnpm typecheck           # TypeScript en todos los paquetes
pnpm build               # Build completo (todos los paquetes)

pnpm --filter @impostor/mobile android   # Build + instalar en Android
pnpm --filter @impostor/mobile build:web # Exportar web estático
pnpm --filter @impostor/mobile prebuild  # Generar carpetas android/ e ios/

pnpm --filter @impostor/backend exec npx convex deploy --prod  # Deploy producción
```

---

## Troubleshooting frecuente

### Metro crashea al iniciar (ENOENT en src-tauri/target)
Ya está resuelto en `metro.config.js` con `blockList`. Si vuelve a pasar, verificar que el regex excluye la carpeta `target/` de Rust.

### Convex rechaza campo con emoji como clave
Los field names de Convex deben ser ASCII. Las reacciones se guardan como array `[{emoji, count}]`, no como objeto `{"🔥": 2}`.

### Error Android: `Unsupported class file major version 69`
Java demasiado nuevo. Setear `JAVA_HOME` a Java 17:
```powershell
$env:JAVA_HOME = "C:\Users\TU_USUARIO\.sdkman\candidates\java\17.0.11-tem"
```

### Convex: "developing anonymously"
El `packages/backend/.env.local` tiene `CONVEX_DEPLOYMENT=anonymous:...`. Correr `npx convex dev` desde `packages/backend` para vincularlo a un proyecto cloud.

### TypeScript errors en monorepo
```powershell
pnpm typecheck   # Ver errores en todos los paquetes
# Si hay errores de tipos en Convex generated: pnpm convex:dev (regenera _generated/)
```

### Tauri: `frontendDist` no encontrado
La ruta en `tauri.conf.json` debe ser relativa a `src-tauri/`. Verificar que sea `../../mobile/dist` (no `../../../`).
