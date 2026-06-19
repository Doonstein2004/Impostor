# Roadmap

## v1 (este scaffold) ✅
- Monorepo pnpm + Turborepo.
- App Expo (Web/iOS/Android) con Expo Router + NativeWind.
- Desktop con Tauri v2 envolviendo el build web.
- Backend Convex: salas, configuración, reparto secreto de roles, votación y reveal.
- Dataset curado de jugadores y DTs por zona/época/rol.
- Lógica de juego pura y testeada en `@impostor/core`.

## v2 — Audio de sala 🎙️ (decidido: LiveKit)
Quedó **fuera del v1** a propósito. Plan de integración:

1. Crear `packages/audio` con un wrapper sobre `@livekit/react-native` (nativo) y
   `livekit-client` (web), exponiendo un hook `useVoiceRoom(roomCode)`.
2. Backend: una mutation/action de Convex que genere el **access token** de LiveKit
   (firma server-side con el API secret) por sala. Convex `action` puede llamar a la API.
3. UI: un botón "Unirse al audio" en el Lobby y un indicador de quién está hablando.
4. Self-host de LiveKit (Docker) o LiveKit Cloud para empezar.

> Alternativas evaluadas: Agora (más simple, menos abierto), Daily.
> LiveKit gana por ser open-source, con SDK RN y control de costos.

## v3 — Cuentas y social
- Auth real (Convex Auth: anónima → upgrade a email/OAuth).
- Amigos persistentes e invitaciones por deep link (`impostor://room/CODE`).
- Historial de partidas y estadísticas por jugador.

## v4 — Contenido y monetización
- Ranking global / ligas.
- Packs de categorías (mundiales, ligas específicas, mujeres, selecciones).
- Modo "experto" con pistas más difíciles; modo cronometrado por turno.
- Ampliar el dataset (ver `docs/DATA.md`).

## Deuda técnica / mejoras
- Presencia real (heartbeat) para marcar `connected` con precisión.
- Reconexión y manejo de "host se va a mitad de partida".
- Límite de tiempo por turno (`turnSeconds` ya está en el modelo, falta UI/timer).
- Tests e2e de los flujos de sala.
- Íconos/splash reales en `apps/mobile/assets` y `apps/desktop/src-tauri/icons`.
