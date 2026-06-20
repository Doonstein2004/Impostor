---
name: audio-livekit-decision
description: Sala de audio del juego Impostor — se eligió LiveKit (self-host gratis o cloud free tier)
metadata:
  type: project
---

Para la "sala de audio" del juego Impostor se evaluaron LiveKit, WebRTC P2P y diferir.

**Decisión:** usar **LiveKit** cuando se implemente. Es open source (Apache 2.0), se puede self-hostear gratis, tiene cloud free tier, y SDKs oficiales para React Native y web → cubre web (Vercel) + Android. WebRTC P2P se descartó por frágil en mobile/NAT.

**Why:** el usuario pidió audio gratuito que funcione en todas las plataformas, self-host OK. LiveKit es el único que cumple las tres cosas bien.

**How to apply:** requiere un servidor LiveKit (self-host con TURN, o LiveKit Cloud free tier) + un endpoint que firme tokens de acceso (se puede hacer con una Convex action). En Expo necesita dev build (no funciona en Expo Go); web funciona directo.

El usuario eligió avanzar **por partes**: primero reacciones persistentes + rediseño de pistas + chat de texto + toggle de config audio/texto; el audio (LiveKit) queda para una fase posterior. Ver [[CLAUDE]].
