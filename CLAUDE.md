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
| Frontend | Expo SDK 52 + Expo Router + React Native Web |
| Estilos | NativeWind v4.1.23 (Tailwind para RN) |
| Animaciones | react-native-reanimated v3.16 |
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

- **Kotlin 1.9.25** requerido por `expo-modules-core` (Compose Compiler 1.5.15).
  - Fix 1 en `apps/mobile/android/gradle.properties`:
    ```
    android.kotlinVersion=1.9.25
    ```
  - Fix 2 en `apps/mobile/android/build.gradle` — classpath explícito (sin fix la BOM de RN fuerza 1.9.24):
    ```groovy
    classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}")
    ```

### Pasos completos para compilar el APK debug

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
cd "C:\Dev\Impostor\apps\mobile\android"
.\gradlew clean
.\gradlew app:assembleDebug -x lint -x test
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

- Proyecto: `impostor-futbol` en Vercel.
- Archivo: `apps/mobile/vercel.json` — rewrite SPA para que todas las rutas apunten a `index.html`.
- Build command: `pnpm --filter @impostor/mobile run export`
- Output directory: `apps/mobile/dist`

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

## Historial de cambios importantes

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
