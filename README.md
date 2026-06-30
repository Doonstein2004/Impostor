# ⚽ Impostor Fútbol — Monorepo / Plantilla de granja de apps

Juego del **Impostor** temático de fútbol: a todos se les muestra el mismo jugador
(o DT) menos al impostor. Por turnos dan pistas sin nombrarlo y luego votan quién no
sabía de quién hablaban.

Una sola base de código para **Web, iOS, Android y Desktop**, pensada como plantilla
reutilizable para futuras apps.

---

## 🧱 Stack

| Capa            | Tecnología                                   |
| --------------- | -------------------------------------------- |
| Monorepo        | **pnpm workspaces** + **Turborepo**          |
| App (Web/iOS/Android) | **Expo** (React Native + RN Web) + **Expo Router** |
| Desktop         | **Tauri v2** (envuelve el build web)         |
| Estilos / UI    | **Uniwind** (Tailwind v4) + paquete `@impostor/ui`    |
| Backend/Realtime| **Convex** (DB reactiva + funciones)         |
| Estado local    | **Zustand**                                  |
| Datos jugadores | Dataset **curado y bundleado** (`@impostor/data`) |
| Audio (futuro)  | LiveKit — ver [`docs/ROADMAP.md`](docs/ROADMAP.md) |


---

## 📁 Estructura

```
impostor/
├── apps/
│   ├── mobile/      # App Expo: Web + iOS + Android (Expo Router)
│   └── desktop/     # Tauri v2 que envuelve el build web de mobile
├── packages/
│   ├── core/        # Lógica de juego pura + tipos (sin UI, sin backend) — testeada
│   ├── data/        # Dataset curado de jugadores y DTs + generador
│   ├── backend/     # Convex: schema + funciones (salas, partida, votación)
│   └── ui/          # Componentes cross-platform (Uniwind) + preset de diseño

├── docs/            # Documentación de arquitectura, datos y roadmap
└── turbo.json, pnpm-workspace.yaml, tsconfig.base.json
```

El flujo de dependencias es: `core` ← `data` ← `backend` ← `apps`, y `ui` ← `apps`.
`core` no depende de nada (corre igual en el server de Convex y en el cliente).

---

## 🚀 Puesta en marcha

Requisitos: **Node ≥ 20**, **pnpm 9**, y para desktop: **Rust** + toolchain de Tauri
([guía oficial](https://tauri.app/start/prerequisites/)).

```bash
# 1. Instalar dependencias
pnpm install

# 2. Levantar Convex (crea el deployment y genera convex/_generated)
pnpm convex:dev
#    -> copiá la URL que imprime a apps/mobile/.env como EXPO_PUBLIC_CONVEX_URL
cp apps/mobile/.env.example apps/mobile/.env   # y pegá la URL

# 3. Levantar la app (en otra terminal)
pnpm --filter @impostor/mobile dev     # Expo: presioná w (web), a (android), i (ios)
```

> **Importante:** corré `pnpm convex:dev` **antes** del primer `typecheck`/build de la app,
> porque genera `packages/backend/convex/_generated` (la API tipada que importa la app).

### Desktop (Tauri)

```bash
pnpm --filter @impostor/desktop dev     # dev: usa el server de Expo web
pnpm --filter @impostor/desktop build   # build: exporta web + empaqueta binario
```

---

## 🧪 Scripts útiles (raíz)

```bash
pnpm dev          # turbo: levanta los dev de cada paquete
pnpm typecheck    # typecheck de todo el monorepo
pnpm build        # build de todo
pnpm data:generate  # stats del dataset / punto de extensión de datos
pnpm --filter @impostor/core test   # tests de la lógica de juego
```

---

## 🎮 Cómo se juega (flujo de la app)

1. **Inicio** → ponés tu nombre y **creás** una sala (código de 6 caracteres) o te **unís**.
2. **Lobby** → invitás amigos (compartir código), y el host configura la partida:
   zonas (portero/defensor/medio/atacante), épocas (antiguos, leyendas, modernos,
   experimentados, actuales, jóvenes promesas), tipo (jugadores/DTs), nº de impostores
   y qué recibe el impostor (nada / pista / jugador similar).
3. **Partida** → cada uno ve su carta secreta (privada). Por turnos dan pistas.
4. **Votación** → todos votan quién es el impostor.
5. **Reveal** → se muestra el jugador secreto, los impostores y el marcador. Revancha.

La **lógica** vive en [`packages/core`](packages/core) y corre en el servidor (Convex),
así el impostor nunca se filtra al cliente.

---

## 🌱 Usar esto como plantilla para otra app

Ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) → sección *"Clonar para una nueva app"*.
En resumen: `packages/core`, `data` y la temática se reemplazan; `ui`, `backend` (patrón
de salas) y la config de Expo/Tauri se reutilizan casi tal cual.

---

## 📚 Documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — decisiones, capas y cómo extender.
- [`docs/DATA.md`](docs/DATA.md) — de dónde salen los datos y cómo ampliarlos (legal incluido).
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — audio (LiveKit), auth, ranking global, etc.
