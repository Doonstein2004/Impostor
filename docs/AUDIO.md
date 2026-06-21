# Sala de audio (LiveKit) — setup

La sala de audio usa **LiveKit**. El código ya está implementado para **web y escritorio
(Tauri)**; en Android/iOS nativo se muestra un aviso ("usá la web") porque el SDK nativo
requiere un dev build (fase siguiente).

Arquitectura:

```
Cliente (web)  ──connect(wss, token)──►  Servidor LiveKit (Cloud o self-host)
     │
     └─ pide token a ──►  Convex action `livekit.token`  (firma con API key/secret)
```

Hay **3 datos** que configurar:

| Dato | Dónde va | Para qué |
|------|----------|----------|
| `EXPO_PUBLIC_LIVEKIT_URL` | `apps/mobile/.env` (y Vercel) | URL del server, la usa el cliente |
| `LIVEKIT_API_KEY` | env del server (Convex) | firmar tokens |
| `LIVEKIT_API_SECRET` | env del server (Convex) | firmar tokens |

> Sin estos datos, el modo audio muestra "Audio no configurado" y no rompe nada.

---

## Opción A — LiveKit Cloud (free tier) — recomendada para empezar

1. Crear cuenta y un proyecto en https://cloud.livekit.io
2. En el proyecto vas a tener: **Project URL** (`wss://xxxx.livekit.cloud`), **API Key** y
   **API Secret**.
3. **Cliente**: en `apps/mobile/.env`:
   ```
   EXPO_PUBLIC_LIVEKIT_URL=wss://xxxx.livekit.cloud
   ```
   En Vercel: agregar la misma variable en Settings → Environment Variables.
4. **Server (Convex)**: setear las llaves como env vars del deployment:
   ```bash
   cd packages/backend
   npx convex env set LIVEKIT_API_KEY <API_KEY>
   npx convex env set LIVEKIT_API_SECRET <API_SECRET>
   ```
   (o desde el dashboard de Convex → Settings → Environment Variables). Para producción,
   setearlas también en el deployment de prod.
5. Pushear funciones: `pnpm convex:dev` (o `convex deploy`).
6. En el lobby, **Reglas → Comunicación → 🎙️ Sala de audio**. Abrí el juego en web; al entrar
   a la partida se conecta y el navegador pide permiso de micrófono.

---

## Opción B — Self-host (Docker)

Gratis pero mantenés vos el server. Necesitás un dominio con TLS (para `wss`) y abrir puertos.

1. `keys.yaml` (clave/secreto propios):
   ```yaml
   # keys.yaml
   APIKey: APIxxxxxxxx
   APISecretxxxxxxxx: <secret-largo-aleatorio>
   ```
   (o generá con `docker run --rm livekit/livekit-server generate-keys`)

2. `docker-compose.yml`:
   ```yaml
   services:
     livekit:
       image: livekit/livekit-server:latest
       command: --config /etc/livekit.yaml
       restart: unless-stopped
       network_mode: host          # simplifica los puertos UDP de WebRTC
       volumes:
         - ./livekit.yaml:/etc/livekit.yaml
         - ./keys.yaml:/etc/keys.yaml
   ```

3. `livekit.yaml`:
   ```yaml
   port: 7880
   rtc:
     tcp_port: 7881
     port_range_start: 50000
     port_range_end: 50100
     use_external_ip: true
   keys:
     APIxxxxxxxx: <secret-largo-aleatorio>   # mismo par que arriba
   turn:
     enabled: true
     domain: tu-dominio.com
     tls_port: 5349
   ```
   Poné un reverse proxy (Caddy/Nginx) con TLS apuntando a `:7880` para servir `wss://`.

4. **Cliente**: `EXPO_PUBLIC_LIVEKIT_URL=wss://tu-dominio.com`
5. **Server (Convex)**: `LIVEKIT_API_KEY=APIxxxxxxxx`, `LIVEKIT_API_SECRET=<secret>`
   (con `npx convex env set ...`).
6. Pushear + usar igual que en la opción A.

---

## Cómo funciona en el código

- `packages/backend/convex/livekit.ts` — action `token` (Node) que firma el JWT con
  `livekit-server-sdk`. Room de LiveKit = `impostor-<codigo>`.
- `apps/mobile/src/components/AudioRoom.web.tsx` — sala real con `livekit-client`: conecta,
  publica el mic, lista participantes (anillo verde si hablan, 🔇 si están muteados) y un
  botón de micrófono. Se monta persistente mientras estás en la sala, así no se corta al
  colapsar el panel. Reporta su alto a `useChatDock` (las pantallas reservan ese espacio).
- `apps/mobile/src/components/AudioRoom.tsx` — placeholder para nativo (Metro resuelve
  `.web.tsx` en web y este en nativo).
- `apps/mobile/app/room/[code].tsx` — si `commMode === 'audio'` monta `AudioRoom`; si no,
  el `GameChat` de texto.

## Pendiente (fase siguiente)
- **Android/iOS nativo**: agregar `@livekit/react-native` + `@livekit/react-native-webrtc`
  y su config plugin, y compilar con dev build/EAS (no Expo Go).
