'use node';

import { v } from 'convex/values';
import { AccessToken } from 'livekit-server-sdk';
import { api } from './_generated/api';
import { action } from './_generated/server';

/**
 * Firma un token de acceso a la sala de audio de LiveKit.
 * Requiere las env vars del servidor `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET`
 * (se setean con `npx convex env set ...`). La URL del server va en el cliente
 * vía `EXPO_PUBLIC_LIVEKIT_URL`.
 */
export const token = action({
  args: { roomCode: v.string(), clientId: v.string(), name: v.string() },
  handler: async (ctx, { roomCode, clientId, name }): Promise<{ token: string; room: string }> => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new Error('LiveKit no está configurado (faltan LIVEKIT_API_KEY/SECRET en el server)');
    }

    // Verifica que la sala exista antes de dar acceso al audio.
    const room = await ctx.runQuery(api.rooms.get, { code: roomCode });
    if (!room) throw new Error('Sala no encontrada');

    const lkRoom = `impostor-${room.code}`;
    const at = new AccessToken(apiKey, apiSecret, { identity: clientId, name, ttl: '2h' });
    at.addGrant({ roomJoin: true, room: lkRoom, canPublish: true, canSubscribe: true });

    return { token: await at.toJwt(), room: lkRoom };
  },
});
