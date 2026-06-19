# Arquitectura

## Principios

1. **Una sola base de código** para Web, iOS, Android y Desktop.
   - Expo + React Native Web cubre Web/iOS/Android.
   - Tauri v2 envuelve el **mismo build web** para Desktop (sin reescribir nada).
2. **Lógica de juego desacoplada de la UI y del backend** (`@impostor/core`).
   Es TypeScript puro y determinista (acepta un RNG inyectable) → testeable y
   reutilizable tanto en el cliente como dentro de funciones de Convex.
3. **El secreto nunca llega al cliente equivocado.** El reparto de roles
   (quién es impostor, cuál es el jugador secreto) ocurre en Convex. Cada cliente
   sólo puede leer **su propia** carta (`game.getMyCard`), no la de los demás.
4. **Monorepo con límites claros** para que sirva de plantilla de granja de apps.

## Capas

```
┌─────────────────────────────────────────────────────────┐
│ apps/mobile (Expo Router)        apps/desktop (Tauri)    │
│   UI screens + componentes         envuelve build web    │
└───────────────┬──────────────────────────┬──────────────┘
                │ usa                        │ reusa
        ┌───────▼────────┐          ┌────────▼────────┐
        │ @impostor/ui   │          │ @impostor/data  │
        │ (NativeWind)   │          │ (dataset)       │
        └────────────────┘          └────────┬────────┘
                                              │ usa
   ┌──────────────────────────┐      ┌────────▼────────┐
   │ @impostor/backend (Convex)│◄─────┤ @impostor/core  │
   │  schema + mutations/queries│ usa │ (lógica + tipos)│
   └──────────────────────────┘      └─────────────────┘
```

## Modelo de datos (Convex)

- **rooms**: código, host, status (`lobby|playing|voting|reveal|finished`), `config`, ronda actual.
- **players**: jugadores por sala (nombre, host, score, conexión).
- **rounds**: ronda activa con el `secretCharacterId` y los `impostorClientIds` (secreto, server-only).
- **assignments**: una fila por jugador = lo que **ese** jugador ve. Se consulta sólo la propia.
- **votes**: voto por jugador en la ronda (cambiable hasta el reveal).

### ¿Por qué `assignments` separado?
Para que la query que un cliente ejecuta devuelva **únicamente** su carta. Si guardáramos
todos los roles en un solo documento de ronda y lo expusiéramos, el impostor se filtraría.

## Flujo de una partida

```
Home ──create/join──► Lobby ──host startRound──► Playing
                         ▲                          │ host startVoting
                         │ host backToLobby         ▼
                      Reveal ◄──host reveal──── Voting
```

El estado vive en Convex y es **reactivo**: todos los clientes suscritos a `rooms.get`
re-renderizan solos cuando cambia el status (sin polling ni sockets manuales).

## Estilos

`@impostor/ui` define un **preset de Tailwind** (`tailwind-preset.js`) con la paleta de
marca (verde cancha / rojo impostor / superficies oscuras). Cada app lo extiende en su
`tailwind.config.js`. Los componentes usan `className` vía NativeWind v4, que funciona
igual en web y nativo.

> Nota sobre NativeWind en monorepo: el `tailwind.config.js` de la app incluye en `content`
> la ruta a `packages/ui/src`, y `metro.config.js` agrega la raíz del workspace a
> `watchFolders`, para que las clases del paquete UI se compilen.

## Clonar para una nueva app (granja)

1. Copiá el repo y renombrá los paquetes `@impostor/*` → `@tu-app/*`.
2. **Reemplazá la temática**:
   - `packages/core` → tus reglas/tipos de juego.
   - `packages/data` → tu dataset.
3. **Reutilizá casi tal cual**:
   - `packages/ui` (cambiá sólo la paleta del preset).
   - `packages/backend` → el patrón salas/jugadores/votación es genérico para party games.
   - `apps/mobile` config (Expo Router, NativeWind, Convex provider).
   - `apps/desktop` (Tauri) — sólo cambiás `productName`/`identifier`.
4. Cambiá `identifier`/`bundleIdentifier`/`package` en `app.json` y `tauri.conf.json`.
