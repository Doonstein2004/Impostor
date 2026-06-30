# CLAUDE.md — Instrucciones internas del proyecto

Este archivo es leído automáticamente por Claude Code al iniciar cada sesión.
Contiene reglas de trabajo, decisiones de arquitectura y el historial de cambios importantes.

---

## Reglas generales

- **Siempre documentar aquí** cualquier cambio de arquitectura, decisión técnica o fix no trivial.
- Explicar el **porqué**, no solo el qué. El qué está en el código.
- Antes de hacer un commit, verificar que TypeScript no tiene errores (`pnpm typecheck`).
- No repetir personajes por sesión — ver sección "No-repeat characters".
- El backend Convex usa **solo ASCII** en nombres de campos (sin emojis).

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | Expo SDK 56 + Expo Router + React Native Web 0.21 |
| React | React 19.2.7 + React Native 0.86.0 |
| Estilos | Uniwind v1.9.0 (Tailwind 4 para RN) + tailwind-merge |
| Animaciones | react-native-reanimated v4.5.0 + react-native-worklets v0.10.0 |
| Backend | Convex (reactive DB + mutations/queries) |
| Desktop | Tauri v2 |
| Monorepo | pnpm workspaces + Turborepo |

### Workspaces
- `apps/mobile` — App Expo (web + Android + iOS)
- `apps/desktop` — App Tauri
- `packages/backend` — Convex schema, mutations, queries
- `packages/core` — Tipos compartidos, config por defecto, lógica de pool
- `packages/data` — Base de datos de personajes
- `packages/ui` — Componentes base (Button, Card, Screen, Text)

---

## Convex Cloud

- **Dev deployment**: `dev:curious-sheep-977` → `https://curious-sheep-977.convex.cloud`
- El deployment de dev es persistente; no hace falta dejar `pnpm convex:dev` corriendo para que los amigos puedan jugar.
- Solo se necesita `pnpm convex:dev` durante desarrollo activo (para hot-push de funciones).
- Archivo de config: `packages/backend/.env.local`
- URL en frontend: `apps/mobile/.env` → `EXPO_PUBLIC_CONVEX_URL`

---

## Variables de entorno

### `packages/backend/.env.local`
```
CONVEX_DEPLOYMENT=dev:curious-sheep-977
CONVEX_URL=https://curious-sheep-977.convex.cloud
CONVEX_SITE_URL=https://curious-sheep-977.convex.site
```

### `apps/mobile/.env`
```
EXPO_PUBLIC_CONVEX_URL=https://curious-sheep-977.convex.cloud
```

---

## Android — Requisitos de build

- **El proyecto DEBE estar en una ruta corta** (máx. ~50 chars). Recomendado: `C:\Dev\Impostor`.
  - **Por qué**: react-native-reanimated usa CMake con rutas absolutas para sus fuentes C++.
    CMake crea archivos objeto espejando la ruta: `CMakeFiles/reanimated.dir/C_/Users/...`.
    Si el proyecto está en `C:\Users\daniel.bello\Documents\Proyectos\Teste\Impostor`, la ruta
    espejo supera ~320 chars y ninja no puede crear los directorios.
  - Este es un bug conocido de react-native-reanimated en Windows con paths largos.
  - Junctions/subst NO funcionan porque Gradle y CMake resuelven a la ruta real.

- **Java 17** requerido (no más nuevo). Instalar en Windows:
  ```powershell
  winget install Microsoft.OpenJDK.17
  ```
  - Ruta instalada: `C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot`
  - Setear antes de compilar:
    ```powershell
    $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
    $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
    ```

- **Kotlin 2.1.20** requerido por RN 0.86 / Expo 56 + New Architecture.
  - Seteado en `app.json` vía plugin `expo-build-properties`:
    ```json
    { "android": { "kotlinVersion": "2.1.20" } }
    ```
  - Ya no hace falta el classpath explícito en `build.gradle` (expo-build-properties lo maneja).


### Script de build: `scripts/build-android.ps1`

Wrapper PowerShell que configura Java 17 y llama a Gradle. Usar en vez de los pasos manuales.

```powershell
# Uso básico (APK arm64 debug, ~55 MB — para probar en el celular)
.\scripts\build-android.ps1

# Opciones principales
.\scripts\build-android.ps1 -Abi arm64        # arm64-v8a (defecto, modernos)
.\scripts\build-android.ps1 -Abi universal    # todas las ABIs (~216 MB, comportamiento viejo)
.\scripts\build-android.ps1 -BuildType release -Minify   # ~28 MB con R8
.\scripts\build-android.ps1 -Bundle -BuildType release   # AAB para Play Store
.\scripts\build-android.ps1 -Clean -Install              # clean + instalar por ADB
```

**Por qué el universal pesa 216 MB**: 4 ABIs × libs nativas (RN + Reanimated + LiveKit/WebRTC).
WebRTC pesa ~30–40 MB por ABI. En Play Store el usuario descarga solo su ABI (~20 MB).

**Cómo funciona la restricción de ABI**: el script pasa `-PreactNativeArchitectures=arm64-v8a`
a Gradle. Esta propiedad es nativa del plugin de RN (ya existe en `gradle.properties`) y no
requiere modificar `build.gradle`. El APK resultante es ~55 MB (arm64 debug).

**Tamaños esperados**:
| Modo | Tamaño |
|------|--------|
| arm64 debug | ~55 MB |
| arm64 release | ~50 MB |
| arm64 release + Minify | ~28 MB |
| universal debug | ~216 MB |
| AAB release (Play Store) | ~45 MB (descarga ~20 MB) |

### Pasos manuales (alternativa al script)

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
cd "C:\Dev\Impostor\apps\mobile\android"
.\gradlew app:assembleDebug -x lint -x test -PreactNativeArchitectures=arm64-v8a
# APK: C:\Dev\Impostor\apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

---

## GameConfig — campos importantes

```ts
interface GameConfig {
  zones, eras, roles          // filtros del pool de personajes
  impostorCount               // cuántos impostores (1–3)
  impostorHint                // 'nada' | 'pista' | 'similar'
  turnSeconds                 // segundos por turno de pista (0 = sin límite)
  maxRounds?                  // rondas por sesión (0 = sin límite)
  maxClueRounds?              // vueltas de pistas por partida (0 = sin límite)
  voteSeconds?                // segundos para votar (0 = sin límite)
}
```

---

## Flujo de estados de la sala

```
lobby → playing → voting → impostorGuessing → reveal → lobby (o finished)
                                ↗
                    (solo si impostor fue detectado)
```

### impostorGuessing
Cuando el impostor es detectado en la votación, la sala pasa a `impostorGuessing`
en lugar de ir directo a `reveal`. El impostor tiene una chance de adivinar el
personaje secreto. Si acierta, obtiene puntos igual. La mutación `submitImpostorGuess`
normaliza la respuesta (trim + lowercase + NFD) para comparar sin tildes.

---

## No-repeat characters

Los personajes usados en la sesión se guardan en `rooms.usedCharacterIds`.
- En `startRound`: se filtra el pool excluyendo los ya usados. Si el pool queda vacío, se resetea.
- En `backToLobby({ newSession: true })`: se limpia `usedCharacterIds` y se reinician scores y `roundNumber`.
- Los IDs se resetean automáticamente si se agotan todos los personajes del pool filtrado.

---

## Auto-advance de vueltas de pistas

Con `maxClueRounds > 0`, cuando todos los jugadores hablaron en una vuelta:
- Si aún no se llegó al límite → el host avanza automáticamente (sin pausa).
- Si se llegó al límite → se muestra solo el botón "Abrir votación".
- El auto-advance usa un `useRef` (`hasAutoAdvanced`) para evitar doble disparo.

---

## Sistema de presencia (conectado/inactivo)

Implementado en `apps/mobile/src/lib/usePresence.ts`.

**Por qué**: necesitamos saber si un jugador dejó la pestaña o puso la app en fondo
antes de que el host empiece la partida.

**Cómo funciona**:
- Al montar cualquier pantalla de sala: llama `updatePresence({connected: true})`.
- **Web** (Page Visibility API): al cambiar de pestaña → `connected: false`; al volver → `true`.
- **Mobile** (AppState): al ir al fondo → `connected: false`; al volver → `true`.
- Heartbeat cada 30 segundos para actualizar `lastActiveAt`.
- Al desmontar (salir de la sala): `connected: false`.

**Indicadores visuales en Lobby**:
- Dot verde = activo (heartbeat < 60s)
- Dot amarillo = inactivo > 60s (pestaña oculta)
- Dot gris = desconectado

**Warning al host**: si hay jugadores inactivos al hacer clic en "Empezar",
aparece un Alert de confirmación con los nombres de los inactivos.

---

## Reconexión al recargar (web)

El código de sala actual se persiste en el store de sesión (`currentRoomCode`).
- Al entrar a `/room/[code]`: se guarda el código.
- Al salir: se borra.
- En la pantalla home (`/`): si hay un código guardado, aparece un banner
  "SALA ACTIVA → Volver a sala XXXX".

**Por qué**: en mobile browser, al recargar la página se puede perder el contexto
de navegación. Con el banner, el usuario puede volver a su sala sin buscar el código.

---

## Vercel (web frontend)

- Proyecto: `impostor` en Vercel (cuenta doonstein2004s-projects).
- `vercel.json` raíz: buildCommand apunta solo a `@impostor/mobile` para evitar que Turbo
  intente compilar `@impostor/desktop` (tauri) en Linux.
- `apps/mobile/vercel.json`: rewrite SPA para que todas las rutas apunten a `index.html`.
- Build command: `pnpm --filter @impostor/mobile run build:web`
- Output directory: `apps/mobile/dist`

### Variable de entorno requerida en Vercel (NO está en git)
Agregar en Vercel Dashboard → Settings → Environment Variables:
| Variable | Valor |
|----------|-------|
| `EXPO_PUBLIC_CONVEX_URL` | `https://curious-sheep-977.convex.cloud` |

Sin esta variable, el bundle tiene un placeholder y Convex falla con
"Couldn't parse deployment name placeholder".

---

## Comandos frecuentes

```bash
# Levantar todo en desarrollo
pnpm dev

# Solo frontend web
pnpm --filter @impostor/mobile run web

# Solo backend Convex
pnpm --filter @impostor/backend exec npx convex dev

# Build Android (requiere Java 17 en JAVA_HOME)
pnpm --filter @impostor/mobile exec expo run:android

# Typecheck todo
pnpm typecheck

# Deploy Convex a producción
pnpm --filter @impostor/backend exec npx convex deploy

# Export web estático para Vercel
pnpm --filter @impostor/mobile run export
```

---

## Sala de audio (LiveKit) — Fase 3

- **Decisión**: LiveKit (open source, free/self-host, multiplataforma). Ver [[audio-livekit-decision]].
- **Implementado web + escritorio (Tauri)**. Nativo (Android/iOS) queda para fase siguiente
  (requiere `@livekit/react-native-webrtc` + dev build).
- **Token**: `packages/backend/convex/livekit.ts` → action `token` (Node, `'use node'`) firma
  con `livekit-server-sdk`. Room LiveKit = `impostor-<codigo>`. **Función nueva → requiere push.**
- **Cliente**: `AudioRoom.web.tsx` (real, `livekit-client`) + `AudioRoom.tsx` (placeholder
  nativo). Montado en `room/[code].tsx` cuando `commMode === 'audio'` (si no, `GameChat`).
- **Config (3 datos)** — ver `docs/AUDIO.md`:
  - `EXPO_PUBLIC_LIVEKIT_URL` en `apps/mobile/.env` (y Vercel).
  - `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` como env del deployment Convex
    (`npx convex env set ...`).
  - Sin estos datos el modo audio muestra "Audio no configurado" (no rompe nada).

## Historial de cambios importantes

### 2026-06-30 (tanda 18) — Parches de Uniwind, monorepo @source y correcciones SEO

- **Resolución de especificidad en Web (Parche Uniwind)**:
  - Las utilidades de Tailwind CSS v4 inyectadas mediante `@layer utilities` eran anuladas por los estilos estructurales por defecto (unlayered) de React Native Web (ej: `margin: 0px` anulaba a `.mt-12`).
  - Solución: Actualicé [scripts/patch-uniwind.js](file:///C:/Dev/Impostor/scripts/patch-uniwind.js) para aplanar automáticamente todas las capas CSS nativas (`@layer utilities`, `@layer base`, `@layer theme`) en la compilación web de Uniwind, volviéndolas unlayered y dándoles la especificidad correcta.
- **Configuración de escaneo Monorepo (`@source`)**:
  - Se añadió la directiva `@source '../../packages/ui';` en [global.css](file:///C:/Dev/Impostor/apps/mobile/global.css) para que el compilador de Tailwind CSS v4 escanee y compile clases declaradas dentro de la librería compartida de componentes `@impostor/ui` (corrigiendo el bug del padding faltante en `Card.tsx`).
- **Mejoras SEO y PageSpeed en Vercel**:
  - Modifiqué [app.json](file:///C:/Dev/Impostor/apps/mobile/app.json) de la app móvil para cambiar el tipo de salida de la web a `"static"` (en lugar de `"single"` SPA). Esto activa la pre-renderización estática del HTML durante el build, inyectando meta descripciones, canonical links y contenido estructurado de [+html.tsx](file:///C:/Dev/Impostor/apps/mobile/app/+html.tsx) legible para crawlers de inmediato.
  - Se actualizó el componente [Text.tsx](file:///C:/Dev/Impostor/packages/ui/src/Text.tsx) para mapear dinámicamente la variante `'display'` a un elemento `<h1>` semántico de HTML usando `role="heading"` y `aria-level={1}` en la web.
  - Creado archivo [robots.txt](file:///C:/Dev/Impostor/apps/mobile/public/robots.txt) en la carpeta public de la app.
- **Compilación de Android y Kotlin 2.1.20**:
  - Se actualizó la versión de Kotlin a `2.1.20` en `app.json` y se eliminó el plugin heredado `withKotlinVersionCatalogFix` ya que causaba conflictos con Expo 56.

### 2026-06-29 (tanda 17) — Expo SDK 56, Uniwind, SEO, QR y performance


- **Migración Expo SDK 52 → 56** (React 18 → 19.2.7, RN 0.76 → 0.86, expo-router 4 → 56):
  - Todos los paquetes `expo-*` actualizados a versiones `~56.0.x`.
  - `react-native-reanimated` 3.x → 4.5.0 + nueva dep `react-native-worklets ~0.10.0`.
  - `react-native-safe-area-context` 4.12 → 5.8, `react-native-screens` 4.1 → 4.25.
  - `react-native-web` 0.19 → 0.21, `react-native-gesture-handler` 2.x → 3.x.
  - `@types/react` 18.x → 19.2.x. Kotlin Android: 1.9.25 → 2.0.21.

- **Migración NativeWind → Uniwind v1.9.0** (Tailwind 3 → Tailwind 4 CSS-first):
  - `tailwind.config.js` eliminado → `@theme {}` block en `global.css`.
  - `withNativeWind` → `withUniwindConfig` en metro.config.js.
  - Babel: eliminado el preset `nativewind/babel`, conservado solo `react-native-reanimated/plugin`
    (en v4 este plugin re-exporta `react-native-worklets/plugin` internamente).
  - `SafeAreaListener` + `Uniwind.updateInsets` en `_layout.tsx` para forwarding de insets.
  - **Fix bug Uniwind 1.9.0**: el `webResolver` del plugin metro intercepta cualquier import de
    `createOrderedCSSStyleSheet` desde react-native-web y lo redirige a
    `uniwind/components/createOrderedCSSStyleSheet`, pero ese archivo no existía en el paquete.
    Se crearon los tres archivos faltantes (native `.tsx`, ESM `.js`, CJS `.js`) con un simple
    re-export de la implementación original de react-native-web. El script `scripts/patch-uniwind.js`
    (corrido vía `postinstall` raíz) los regenera tras cada `pnpm install`.

- **tailwind-merge** en todos los componentes de `packages/ui` (Button, Card, Badge, Text):
  - Permite que las clases pasadas por `className` overrideen las clases base sin conflictos.

- **React.lazy + Suspense para AudioRoom** (code-split de ~400 KB de LiveKit):
  - `const AudioRoom = lazy(() => import('@/components/AudioRoom'))` en `room/[code].tsx`.
  - Solo se descarga el bundle de audio si el modo de la sala es `'audio'`.

- **Selectores granulares Zustand** (`useShallow`):
  - Todos los 15 usos de `useSession()` migrados a selectores específicos para evitar
    re-renders innecesarios cuando cambia cualquier campo del store.

- **Validación de longitud en Convex** (server-side):
  - `rooms.updateProfile`: nombre 2–20 chars, color max 20.
  - `rooms.updatePassword`: max 50 chars.
  - `tournaments.create`: nombre torneo max 50, nombre equipo max 30.
  - `game.submitImpostorGuess`: respuesta max 100 chars.

- **Haptic feedback** (`apps/mobile/src/lib/useHaptics.ts`):
  - Dynamic import de `expo-haptics` solo en native (guard `Platform.OS !== 'web'`).
  - Integrado en: voto (`Haptics.light`), envío de pista (`Haptics.light`),
    inicio de turno (`Haptics.medium`), reveal (`Haptics.success`/`heavy`).

- **Memoización en GameRound** (`React.memo` + `useCallback`):
  - `PokerCard` (144 líneas) envuelto en `memo()`.
  - `handleSubmit` y `handleDeclaration` con `useCallback` para deps exactas.

- **QR de invitación en Lobby**:
  - Botón "🔲 Mostrar QR" en la card de código de sala.
  - Modal con `react-native-qrcode-svg` (220px, fondo blanco) sobre fondo oscuro semitransparente.
  - URL del QR: `buildJoinUrl(room.code)` (link de invitación ya existente).

- **SEO en `app/+html.tsx`**:
  - `<title>`, `<meta name="description">`, canonical URL.
  - OpenGraph completo (og:title, og:description, og:image 1200×630, og:url, og:locale).
  - Twitter Card `summary_large_image`.
  - JSON-LD `WebApplication` con schema.org.
  - `<link rel="preconnect">` a fonts.gstatic.com.
  - Kotlin en `app.json` actualizado a 2.0.21.

### 2026-06-26 (tanda 16) — Modo declaración, rol Cómplice, fix E2E y color picker compacto

- **Modo declaración** (`declarationMode: boolean` en `GameConfig`):
  - Toggle en la tab "Reglas" del Lobby (dorado cuando activo).
  - Cuando está activo, el input libre de pistas se reemplaza por dos botones:
    **"✅ Lo conozco"** y **"❌ No lo conozco"**. Cada jugador debe elegir uno.
  - Implementado puramente en el cliente: los valores se envían como texto de pista normal
    vía `submitClueAndAdvance`, sin cambios de backend. El feed de pistas muestra el emoji
    de forma natural.
  - **Por qué**: reduce la ambigüedad en grupos donde no todos conocen bien los personajes.
    Fuerza a tomar postura pública sin revelar pistas específicas.

- **Rol Cómplice** (`hasComplice: boolean` en `GameConfig`):
  - Toggle en la tab "Partida" del Lobby (morado cuando activo).
  - Al iniciar la ronda, `setupRound` elige un inocente al azar como cómplice. El cómplice:
    - Ve el personaje secreto igual que los inocentes.
    - Ve el nombre del impostor en su carta (sección "ALIADO SECRETO").
    - Gana y pierde con el **equipo impostor** en todos los escenarios de puntuación.
    - Está exento de la penalidad de voto incorrecto (se trata como equipo impostor).
  - Schema: campo `compliceClientId` en `rounds`, campos `isComplice` + `knowsImpostorClientId`
    en `assignments`.
  - Reveal screen: card morada "El cómplice era…" entre el reveal del impostor y el botón de compartir.
  - `getMyCard`: devuelve `isComplice: bool` + `knowsImpostorName: string|null` (lookup por
    índice `by_room_client`).
  - `getReveal`: devuelve `compliceClientId: string|null`.
  - **Requiere push a Convex** (schema nuevo + cambios en `startRound`, `quickRematch`, `reveal`,
    `submitImpostorGuess`, `getMyCard`, `getReveal`).

- **Fix E2E + color picker compacto**:
  - `playwright.config.ts`: `workers: 1` para serializar todos los tests (evita sobrecarga
    de Metro + Convex con 3 workers paralelos).
  - Selectores migrados de `getByRole('button', ...)` a `getByText(...).first()` —
    React Native Web renderiza `Pressable` como `<div>` sin `role="button"` en el DOM.
  - `ColorPicker`: prop `compact` (swatches 20px). En el Lobby se usa con `flex-1` para que
    los 12 colores quepan en una fila sin desbordarse.

### 2026-06-25 (tanda 15) — Reacciones en tiempo real, modo torneo, fix E2E y build script mejorado

- **Reacciones en tiempo real durante el juego**:
  - Nueva tabla `liveReactions` (roomId, clientId, playerName, emoji, sentAt).
  - Mutation `liveReactions.send` (rate limit 1/s por jugador) + query `list` + `_cleanup` internal (auto-elimina tras 5s con `ctx.scheduler`).
  - `LiveReactionOverlay.tsx`: overlay absoluto con `pointerEvents: 'box-none'`. Emojis flotantes con `FadeIn` + `translateY` + `FadeOut` (Reanimated). Barra de 8 emojis fija en la parte inferior, encima del chat dock. Se integra en `GameRound.tsx` pasando `bottomOffset={chatInset}`.
  - **Requiere push a Convex** (nueva tabla + funciones).

- **Modo torneo**:
  - Nueva tabla `tournaments` (code, name, hostClientId, format, teams, playerTeams, bracket, config). Índice `by_code`.
  - Formato `elimination` (bracket estilo copa) o `round_robin` (todos vs todos). La función `buildEliminationBracket` genera matches incluyendo byes para N equipos no potencia de 2. Los ganadores avanzan automáticamente al siguiente slot del bracket en `recordMatchResult`.
  - Mutations: `create`, `start`, `setMatchRoom`, `recordMatchResult`. Queries: `get` (por código), `getById`.
  - Pantalla `app/tournament/create.tsx`: nombre, formato, equipos (color + nombre), asignación de jugadores a equipos. El host se agrega a sí mismo eligiendo su equipo.
  - Pantalla `app/tournament/[code].tsx`: bracket reactivo por ronda con labels (Cuartos/Semis/Final), clasificación round-robin, podio final, botón "Iniciar match" (crea sala Convex + enlaza al torneo), botón "Registrar resultado" con modal. Comparte resultado con `Share.share`.
  - Link "Torneo" agregado al home (`index.tsx`). Rutas registradas en `_layout.tsx`.
  - **Requiere push a Convex** (nuevas tablas + funciones).

- **Fix E2E tests — timeout**:
  - `playwright.config.ts`: `timeout` 30s→60s, `webServer.timeout` 120s→180s, añadido `stdout/stderr: 'pipe'`. Documentado el workflow correcto (dev server en terminal 1, tests en terminal 2).
  - `home.spec.ts`: `beforeEach` espera 50s a que Metro compile el bundle inicial.
  - Tests de backend (`game.test.ts`, `rooms.test.ts`): añadido `/// <reference types="vite/client" />`, corregido typo `currentSpeakerClientId` → `currentSpeakerId`, añadido `playerName` faltante en `submitClueAndAdvance`, cast correcto de `zones/eras/roles` a tipos union (antes `string[]`).

### 2026-06-24 (tanda 14) — Salas con contraseña, límite de jugadores, rediseño de pistas, abstención, podio y sync script

- **Salas con contraseña**: campo `password` (optional string) en la tabla `rooms`. El host puede
  agregar/cambiar/borrar la contraseña desde el Lobby con la nueva mutation `rooms.updatePassword`.
  `rooms.join` y `rooms.joinAsSpectator` validan la contraseña para jugadores nuevos (los que ya
  estaban en la sala pasan sin revalidar). `rooms.get` expone `hasPassword: boolean` (no la clave).
  En el home, el formulario de "Unirme" muestra el campo de contraseña de forma lazy (solo aparece
  si el primer intento falla con error "contraseña").

- **Límite de jugadores configurable**: campo `maxPlayers` en `GameConfig` (4/5/6/8/10, default 10).
  Selector de chips en la tab "Partida" del Lobby. `rooms.join` lo enforcea para jugadores nuevos.
  El badge de jugadores en el Lobby muestra `{actual}/{máx}` dinámicamente.

- **Historial de personajes en Lobby**: sección colapsable "📋 Jugados esta sesión (N)" visible para
  todos. Muestra los personajes usados en la sesión actual con emoji de zona + nombre. Los IDs vienen
  de `room.usedCharacterIds`; se cruzan con `CHARACTERS` del data package en el cliente.

- **Rediseño de ClueCard** (`components/GameRound.tsx`):
  - Barra de color a la izquierda (4px) con el `avatarHex` del jugador que dio la pista.
  - Animación `FadeInLeft.springify()` al aparecer (antes era `FadeInDown`).
  - Reacciones colapsadas: solo se muestran las activas (conteo > 0 o la propia). Botón `+`
    para expandir todas, `−` para colapsar. Elimina el `ScrollView` horizontal innecesario.
  - `CluesFeed` recibe prop `players: RoomView['players']` y construye un `colorMap` de clientId →
    hex para pasarle `playerColor` a cada `ClueCard`.
  - **Por qué**: con 3 vueltas × 6 jugadores aparecían 18 cajas grandes. Las tarjetas compactas
    permiten ver más pistas sin hacer scroll, y el color identifica al autor de un vistazo.

- **Abstención en votación**:
  - Botón "⚖️ Abstenerme" bajo la lista de jugadores (solo visible si no votaste aún).
  - Implementado como auto-voto (`voterClientId === targetClientId`). No requiere cambios de schema.
  - `game.ts reveal`: filtra self-votes antes de llamar a `tallyVotes` (abstenciones no cuentan).
  - `game.ts submitImpostorGuess`: la penalidad de -1 también excluye abstenciones.
  - `game.ts getReveal`: separa votos reales de abstenciones; devuelve `abstainedClientIds: string[]`
    y `totalVotes` ya excluye las abstenciones.
  - `Reveal.tsx`: chips grises "⚖️ Se abstuvieron" debajo del detalle de votos.
  - **Requirió push a Convex** (cambia el comportamiento de `reveal` y `getReveal`).

- **Podio al fin de sesión** (`Reveal.tsx`):
  - Cuando `isSessionOver`, en vez de una línea de texto aparece: trofeo 🏆, nombre del campeón
    en dorado, y filas de plata/bronce con `PlayerAvatar` + puntaje para los puestos 2 y 3.

- **Script de sync workspace** (`scripts/sync-workspace.js` + `pnpm sync`):
  - Copia los archivos fuente modificados de `packages/{backend,core,data,ui}` a
    `apps/mobile/node_modules/@impostor/*` (solo los más nuevos que su destino, es rápido).
  - Necesario porque en Windows, pnpm usa hardlinks (no junctions/symlinks) para workspace packages.
    TypeScript en `apps/mobile` lee los copies de `node_modules`, no la fuente real.
  - Uso: `pnpm sync` antes de `pnpm typecheck` si cambiaste algo en `packages/`.

### 2026-06-22 (tanda 12) — Avatares de color, presets, leaderboard, compartir, PWA, +600 personajes

- **+600 personajes** en `packages/data/src/players.ts` (de 240 a ~840). Cobertura de
  leyendas e históricos por país, actuales y jóvenes promesas, más DTs. El conteo total **no**
  se muestra al usuario (es sorpresa). Se limpiaron 10 entradas chapuza (name ≠ fullName) y 2
  duplicados reales (Guardado, Donnarumma). Sin IDs ni `fullName` duplicados (salvo pares
  jugador/DT intencionales tipo Cruyff/Zidane).

- **Avatares de color por jugador**:
  - Campo `color` (optional string, key ASCII de la paleta) en `players` (schema) → **requirió push**.
  - `apps/mobile/src/lib/avatars.ts`: paleta `AVATAR_COLORS` (12 colores), `avatarHex(key, seed)`
    (color determinístico por clientId si no eligió) y `defaultColorKey`.
  - `components/PlayerAvatar.tsx`: círculo con inicial pintado con el color. Cableado en Lobby,
    Voting (prop `selected` para el voto), Reveal (ranking), SpectatorView, home.
  - `components/ColorPicker.tsx`: fila de swatches. En el home (junto al nombre, persistido en
    session `avatarColor`) y en el Lobby (cambia en vivo vía nueva mutation `rooms.updateProfile`).
  - `create`/`join`/`joinAsSpectator` aceptan `color` opcional; `get` devuelve `color`.
  - **GameRound se dejó como estaba**: sus avatares codifican estado de turno (quién habla/habló)
    con color, más importante ahí que la identidad.

- **Presets de configuración** (cliente, sin backend): en `session.ts` `configPresets` +
  `savePreset`/`deletePreset` (persistidos, máx 12). En el Lobby (sólo host) chips para aplicar
  y "+ Guardar actual" con input de nombre inline.

- **Leaderboard / ranking**: query `stats.top` (orden: ganadas → win rate → puntaje) → **push**.
  `components/Leaderboard.tsx` + ruta `app/leaderboard.tsx` + entrada en `_layout`. Link "🏆 Ranking"
  en el home (junto a estadísticas). Nota: la ruta usa `router.push('/leaderboard' as never)` porque
  los typed-routes de expo-router se regeneran al correr el dev server.

- **Compartir resultado**: `lib/shareResult.ts`. En web dibuja una tarjeta PNG 1080×1080 en canvas
  (resultado + jugador secreto + impostores + código) y usa `navigator.share({files})`, con caída a
  descarga o portapapeles. En native comparte texto con `Share`. Botón "📤 Compartir resultado" en
  `Reveal.tsx` (para todos).

- **PWA instalable (web)**: `apps/mobile/public/` con `manifest.json`, `sw.js` (service worker
  network-first con shell offline) e `icon.svg`. `app/+html.tsx` inyecta el manifest, theme-color,
  metas apple y registra el SW. Expo SDK 52 copia `public/` al root del build web.
  **Pendiente**: idealmente PNG 192/512 (ahora se usa SVG, soportado por Chrome/Edge; iOS prefiere PNG).

### 2026-06-23 (tanda 13) — Audio nativo + chat UX + colores discretos

- **Audio nativo con LiveKit (Android/iOS)**: `AudioRoom.tsx` reescrito con implementación real.
  - Paquetes: `@livekit/react-native` + `@livekit/react-native-webrtc` (parchean los globals de WebRTC).
  - `registerGlobals()` al inicio del módulo. `Room`/`RoomEvent` siguen de `livekit-client` (funciona porque los globals quedan patched).
  - `AudioSession.startAudioSession()` antes de conectar / `stopAudioSession()` al desmontar — routing nativo (altavoz/auricular/bluetooth).
  - Sin adjuntar `<audio>` al DOM (el audio nativo se reproduce solo). Sin lockeo de autoplay.
  - Permisos: `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` en `AndroidManifest.xml`; `NSMicrophoneUsageDescription` en `app.json`.
  - UI del dock idéntica a la versión web.
  - **REQUIERE build nativo** (`expo run:android` o EAS). No funciona en Expo Go.

- **Chat UX fixes**: botón colapsar pasa de `▴` (invisible) a círculo visible con `✕`; altura máx. de mensajes 300→180px.
- **Colores más discretos**: swatches 30→24px; el Card grande "Tu color" del Lobby reemplazado por fila compacta inline.

### Pendiente próximo
- **Build nativo**: necesario para activar el audio en Android/iOS. Ver "Android — Requisitos de build" (Java 17).
- **PWA icon PNG**: idealmente PNG 192/512 para iOS (hoy SVG funciona en Chrome/Edge).

### 2026-06-22 (tanda 11) — Rematch, auto-kick, sonidos, tutorial, estadísticas, espectador

- **Revancha inmediata (`quickRematch`)**: nueva mutation en `game.ts` que salta el lobby y
  arranca la siguiente ronda directamente. `Reveal.tsx` muestra botón "⚡ Revancha inmediata"
  (host) además del botón "⚙️ Volver al lobby".

- **Auto-kick por inactividad**: cuando un jugador se desconecta durante una partida activa,
  `updatePresence` programa `ctx.scheduler.runAfter(3min, internal.rooms.autoKickCheck)`.
  La internal mutation `autoKickCheck` verifica si el jugador sigue desconectado (y no reconectó
  después de la desconexión que disparó el check) y lo expulsa. Transfiere el host si era host.
  **IMPORTANTE**: requiere push a Convex (usa `internalMutation` y `ctx.scheduler`).

- **Sonidos (Web Audio API)**: `lib/useSounds.ts` genera tonos proceduralmente con `AudioContext`
  (sin dependencias, degrada en native). Eventos: `myTurn` (al empezar tu turno), `tick`/`tickUrgent`
  (countdown últimos 10/5s), `vote` (al votar), `innocentsWin`/`impostorWins` (al revelar).

- **Tutorial interactivo**: `components/TutorialModal.tsx` — modal con 5 slides explicando las
  reglas. `TutorialModal` se muestra automáticamente la primera vez que se entra a una sala
  (flag `tutorialSeen` en session store, persistido). `TutorialButton` ("? Cómo jugar") en el
  Lobby para relanzarlo manualmente.

- **Estadísticas por jugador**: nueva tabla `stats` en schema (index `by_client`).
  `stats.ts` — mutation `recordGame` (upsert por `clientId`) + query `get`.
  Se registra al final de cada partida, inline en `reveal` y `submitImpostorGuess` vía
  helper `upsertStats(ctx, ...)` (no puede llamarse desde mutation otra mutation, se hace con `ctx.db` directo).
  Pantalla `/stats` con win rate, partidas como impostor/inocente, veces detectado, etc.
  Botón "📊 Ver mis estadísticas" en el home.
  **IMPORTANTE**: schema nuevo → requiere push a Convex.

- **Modo espectador**: campo `isSpectator: v.optional(v.boolean())` en tabla `players`.
  Mutation `joinAsSpectator` permite entrar a cualquier sala sin importar el estado.
  En el home, si `join` falla con "partida ya empezó" se ofrece card de espectador.
  `SpectatorView.tsx` — vista solo lectura con turno actual, feed de pistas, lista de jugadores.
  El espectador ve el chat pero no puede dar pistas ni votar.
  **IMPORTANTE**: schema nuevo → requiere push a Convex.

### 2026-06-20 (tanda 10) — Sistema de toasts (nada queda mudo)
- **Toast global**: `lib/useToast.ts` (store zustand + `toast.error/info/success` + `runAction`)
  y `components/Toast.tsx` (banner arriba, auto-dismiss 4s), montado en `_layout`.
- **`lib/errors.ts`**: `friendlyError()` traduce los errores del backend a español claro
  (código mal, ya empezó, solo host, votación cerrada, etc.). El home lo reutiliza.
- **Toda mutación con feedback**: se envolvieron con `runAction`/try-catch+toast:
  `updateConfig` (Lobby), `skipSpeaker`/`nextClueRound`/`startVoting`/`backToLobby`/
  `submitClueAndAdvance` (GameRound), `castVote`/`reveal` (Voting), `submitImpostorGuess`
  (ImpostorGuess), `backToLobby` (Reveal), `messages.send` (Chat).
- **Eventos avisados**: cambio de host ("Ahora sos el host 👑") y cancelación de ronda
  ("El host canceló la ronda") detectados en `room/[code].tsx` por transición de
  `hostClientId`/`status`. Expulsión y errores del home ya estaban (tanda 9).

### 2026-06-20 (tanda 9) — Mensajes/feedback que faltaban
- **Errores del home inline**: `index.tsx` ya no usa `Alert.alert` (mudo en web). Ahora muestra
  cards inline: código mal ("no existe…"), partida ya empezada, falta nombre. `friendlyError()`
  traduce los mensajes del backend.
- **Aviso de expulsión**: el store de sesión tiene `notice` (flash) y `leaving` (salida
  voluntaria, transitorios, no persistidos). `room/[code].tsx` detecta si el jugador dejó de
  figurar en `players` estando presente → si no fue salida voluntaria, setea
  `notice='Te expulsaron…'` y vuelve al home, que muestra el aviso. Cada botón de salir
  (Lobby/GameRound/Voting/Reveal) hace `setLeaving(true)` antes de `leave` para no confundir
  salida con expulsión.

### 2026-06-20 (tanda 8) — Auto-reveal, autocompletar, feed invertido
- **Auto-reveal al votar todos**: `Voting.tsx` ahora revela automáticamente cuando todos
  votaron (no hay que esperar a que el host clickee). Sigue habiendo auto-reveal por timer y
  el botón manual del host como respaldo.
- **Scrollbar con estilo (web)**: CSS en `global.css` (`::-webkit-scrollbar` + Firefox
  `scrollbar-width/color`): fina, redondeada, dorada al hover.
- **Adivinanza del impostor con autocompletar**: `ImpostorGuess.tsx` ya no es input duro;
  muestra sugerencias del pool (`filterPool(CHARACTERS, room.config)`) filtradas por lo que
  se escribe; se elige tocando (sin error de tipeo). Si nada coincide, deja "arriesgar" el
  texto. El backend `submitImpostorGuess` ya normalizaba (no cambió).
- **Pistas más recientes arriba**: `CluesFeed` invierte el orden (vueltas y pistas desc);
  el badge "NUEVA" pasó a `i === 0`.
- **+30 jugadores menos conocidos**: `players.ts` (Pjanić, Hamšík, Cambiasso, Zanetti, Banega,
  Verratti, Immobile, Vardy, etc.) para que sea más difícil.

### 2026-06-20 (tanda 7) — Orden de vueltas + desfase de timer
- **Orden de turnos entre vueltas**: `nextClueRound` re-barajaba el `speakerOrder` en cada
  vuelta. Ahora **conserva el orden de la primera vuelta** (filtra a los que se fueron y
  agrega al final a los que se sumaron). El orden de pregunta se mantiene toda la partida.
- **Timer adelantado en mobile**: el contador comparaba `Date.now()` del cliente con el
  `turnStartedAt` del servidor → si el reloj del teléfono está desfasado, el timer corre
  adelantado/atrasado. Nueva query `time.now` (hora del servidor); `useCountdown` mide el
  desfase una vez y lo aplica, así el contador es consistente entre dispositivos.
  **IMPORTANTE**: `time.ts` es función nueva → requiere push a Convex.

### 2026-06-20 (tanda 6) — Elementos compactos (mobile)
- **Problema**: en mobile el banner "¡TU TURNO!" (36px) y el timer (96px, text-8xl) ocupaban
  casi toda la pantalla, empujando las pistas de los demás fuera de vista.
- **ShotClock horizontal**: número 96px→30px, ahora en fila con la barra al lado (~40px de alto).
- **MyTurnBanner compacto**: de ~130px a ~44px (fila: "¡TU TURNO!" 18px + subtítulo inline).
- **SpeakerSpotlight compacto**: de columna grande (py-8) a fila (avatar 44 + nombre + "Escuchá").
- **No-tu-turno**: se quitó la card de contexto redundante; orden = spotlight → tu carta → pistas.
- **ClueCard**: texto 24→20px y paddings menores (entran más pistas sin volver a verse apretadas).
- **CluesFeed**: el header "VUELTA n" solo aparece con >1 vuelta (evita doble título).
- **Header nativo del room oculto** (`headerShown: false` en `_layout` y `room/[code]`): cada fase
  ya tiene su barra/salir; así no se duplicaba el inset del status bar (espacio vacío arriba).

### 2026-06-20 (tanda 5) — UX menos scroll + chat que no tapa
- **Chat no tapa (alto dinámico)**: el `CHAT_BOTTOM_INSET` fijo (96) se reemplazó por medición
  real. `useChatDock` (zustand en `lib/useChatDock.ts`) guarda el alto que reporta la barra de
  chat vía `onLayout`; las pantallas usan `useChatInset()` como padding inferior. En modo
  panel lateral el alto es 0. Así el chat nunca tapa la última pista ni los controles.
- **MESA COMPLETA con menos scroll**: encabezado compacto en una línea y **pistas primero**
  (antes iban después del botón gigante de votar). El botón "Abrir votación" quedó debajo de
  las pistas. Con 3 jugadores ya no hay que scrollear para ver las pistas.
- **Turno propio input-first**: se quitó la `PokerCard` gigante del flujo principal; ahora va
  `MyCardStrip` (compacto, ahora también muestra la pista del impostor) + el input arriba, y la
  carta completa quedó detrás de un toggle "Ver mi carta". Mucho menos scroll para escribir.

### 2026-06-20 (tanda 4)
- **Bug "no avisa al iniciar"**: en web `Alert.alert` no funciona, y `handleStart` lo usaba
  para el aviso de jugadores inactivos/desconectados → la partida no arrancaba y no decía
  nada. Reemplazado por **feedback inline** en el Lobby: `startError` (card roja) y
  `confirmInactive` (card amarilla con "Empezar igual"/"Cancelar"). El botón ya no está
  `disabled` silenciosamente; `handleStart` valida y explica.
- **Expulsar jugadores**: nueva mutation `rooms.kick` (host expulsa a un no-host). En el
  Lobby cada jugador no-host tiene una ✕ con confirmación. Resuelve el caso de alguien que
  se desconecta/sale y traba la partida. Mid-game ya estaba cubierto por "SALTAR TURNO" y el
  "Revelar resultado" manual del host.
- **IMPORTANTE**: `rooms.kick` es función nueva → requiere push a Convex (`pnpm convex:dev`).

### 2026-06-20 (tanda 3)
- **Detalle de votos en reveal**: `getReveal` ahora devuelve `votersByTarget` (quién votó a
  cada acusado) y `totalVotes`. `Reveal.tsx` muestra una sección "Votos" con el conteo por
  jugador y los nombres de quienes lo votaron, marcando IMPOSTOR/EXPULSADO.
- **Chat rediseñado (no tapa + fluido)**: `Chat.tsx`
  - **Input siempre visible**: ya no hace falta abrir para escribir.
  - **Panel lateral en web ancho** (`width >= 820`): va fijo a la derecha, sin tapar la
    columna del juego. En mobile/web angosto es barra inferior con historial expandible.
  - **No tapa controles**: exporta `CHAT_BOTTOM_INSET` (96) y las pantallas de juego
    (GameRound, Voting, Reveal, ImpostorGuess) reservan ese alto al final.
  - Nota: en teléfonos (Android/iOS) no hay espacio lateral, por eso ahí el chat es una
    barra inferior con input fijo (no panel al costado).

### 2026-06-20 (tanda 2)
- **Scrollbar en web**: `Screen` y el `ScrollView` de `GameRound` ahora muestran la barra
  de scroll en web (`showsVerticalScrollIndicator={Platform.OS === 'web'}`) para poder
  bajar con el mouse.
- **Chat acoplado (no bloqueante)**: `Chat.tsx` se rediseñó de modal flotante con backdrop
  a un **dock inferior colapsable**. Por defecto es una barra que muestra el último mensaje;
  al expandir NO usa backdrop, así se puede responder sin tapar ni bloquear la pista.
- **Feed de pistas arriba**: en `GameRound` el feed (`cluesFeed`) se subió — debajo del input
  cuando es tu turno, y debajo del spotlight cuando no. Antes quedaba al fondo y se perdía.
- **Enlace de invitación**: `Lobby.invite()` genera una URL que precarga el código
  (`window.location.origin/?code=XXXX` en web; `EXPO_PUBLIC_APP_URL` en mobile). El home
  (`index.tsx`) lee `?code=` con `useLocalSearchParams`, muestra una tarjeta "Te invitaron"
  y deja entrar poniendo solo el nombre.
- **Descartar banner de sala activa**: el banner "SALA ACTIVA" en el home ahora tiene una ✕
  que limpia `currentRoomCode`.
- **Filtro de clubes**: nuevo campo `clubs?: string[]` en `GameConfig`, en `filterPool` y en
  el schema (`clubs` opcional). `@impostor/data` expone `SELECTABLE_CLUBS`/`popularClubs()`
  (clubes con ≥3 personajes, excluyendo selecciones nacionales). Selector en el Lobby (tab
  Jugadores).
- **+30 personajes**: nuevos jugadores y DTs en `players.ts` (actuales, experimentados,
  modernos y clásicos) para enriquecer el pool y el filtro de clubes.
- **IMPORTANTE**: los cambios de schema (`clubs` en `gameConfigValidator`) requieren push a
  Convex (`pnpm convex:dev`) igual que `messages`/`commMode`.

### 2026-06-20
- **Reacciones persistentes**: se eliminó el toast flotante descartable (`ClueNotification`)
  que solo mostraba la última pista. Ahora hay un feed persistente (`CluesFeed` + `ClueCard`
  en `GameRound.tsx`) que muestra TODAS las pistas de la ronda agrupadas por vuelta, siempre
  visible, con la fila completa de 6 emojis de reacción en cada pista. Las reacciones ya no
  desaparecen. **Por qué**: el usuario quería tenerlas presentes durante toda la discusión.
- **Rediseño de pistas**: la vieja `ClueRow` apilaba nombre+pista en ~40px (se veía "achatada").
  `ClueCard` da aire: header con autor, pista en su propia línea grande (24px) y reacciones
  separadas por divisor. La última pista de la vuelta se marca con badge "NUEVA".
- **Chat de sala**: nueva tabla `messages` + `messages.ts` (`send`/`listByRoom`, últimos 80).
  Componente `Chat.tsx` (`GameChat`) = overlay flotante con botón 💬 (badge de no leídos) y
  panel deslizable. Montado en `room/[code].tsx` para todas las fases salvo el lobby.
- **commMode (texto/audio)**: campo nuevo en `GameConfig` (`'texto' | 'audio'`, default `'texto'`),
  en schema (`commMode` opcional) y selector en el Lobby (tab Reglas). Si es `'audio'`, el panel
  muestra un placeholder "próximamente" (la sala de audio real será **LiveKit**, ver decisión).
  **IMPORTANTE**: tras estos cambios hay que pushear el schema/funciones nuevas a Convex
  (`pnpm convex:dev` o `convex deploy`) para que `messages` y `commMode` funcionen en runtime.
  El `_generated/api.d.ts` se editó a mano para incluir `messages` (codegen requiere auth).

### 2026-06-19
- **Fix Android Kotlin**: `android.kotlinVersion=1.9.25` en `gradle.properties`.
  Causa: BOM de RN forzaba 1.9.24, incompatible con Compose Compiler 1.5.15.
- **Sistema de presencia**: nuevo hook `usePresence`, mutation `updatePresence`,
  campo `lastActiveAt` en schema. Indicadores en Lobby + warning al host.
- **Reconexión web**: `currentRoomCode` en session store + banner en home.
- **impostorGuessing**: estado nuevo donde el impostor detectado puede adivinar el personaje.
- **maxClueRounds**: vueltas de pistas por partida, auto-advance entre vueltas.
- **voteSeconds**: timer de votación con auto-reveal.
- **No-repeat characters**: `usedCharacterIds` en rooms, filtrado en `startRound`.
- **Convex Cloud**: deployment `dev:curious-sheep-977`.
- **Vercel**: deploy del frontend web con SPA routing.
- **Leave button**: botón de salida para no-hosts en GameRound, Voting y Reveal.
- **Live reactions**: fix de stale state en ClueNotification (almacenar solo ID).
- **Room code copy**: feedback visual "¡Código copiado!" en Lobby.
