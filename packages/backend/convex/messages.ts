import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

const MAX_LEN = 300;
/** Cuántos mensajes recientes se devuelven al cliente. */
const HISTORY_LIMIT = 80;
/** Rate limit: máx mensajes por ventana de tiempo. */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10_000;

/** Envía un mensaje al chat de la sala. */
export const send = mutation({
  args: {
    roomId: v.id('rooms'),
    clientId: v.string(),
    name: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { roomId, clientId, name, text }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error('La sala no existe');

    // Solo miembros de la sala pueden chatear
    const player = await ctx.db
      .query('players')
      .withIndex('by_room_client', (q) => q.eq('roomId', roomId).eq('clientId', clientId))
      .first();
    if (!player) throw new Error('No sos parte de esta sala');

    // Rate limit: máx 5 mensajes cada 10 segundos por jugador
    const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
    const recent = await ctx.db
      .query('messages')
      .withIndex('by_room', (q) => q.eq('roomId', roomId))
      .order('desc')
      .take(20);
    const fromClientInWindow = recent.filter(
      (m) => m.clientId === clientId && m.createdAt > windowStart,
    );
    if (fromClientInWindow.length >= RATE_LIMIT_MAX) {
      throw new Error('Estás enviando mensajes muy rápido, esperá un momento');
    }

    const trimmed = text.trim();
    if (!trimmed) throw new Error('El mensaje no puede estar vacío');
    if (trimmed.length > MAX_LEN) throw new Error(`El mensaje es muy largo (máx. ${MAX_LEN})`);

    return ctx.db.insert('messages', {
      roomId,
      clientId,
      name,
      text: trimmed,
      createdAt: Date.now(),
    });
  },
});

/** Mensajes recientes de la sala, en orden cronológico ascendente. */
export const listByRoom = query({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, { roomId }) => {
    const recent = await ctx.db
      .query('messages')
      .withIndex('by_room', (q) => q.eq('roomId', roomId))
      .order('desc')
      .take(HISTORY_LIMIT);
    // Se piden los más nuevos primero (take), pero la UI los muestra de viejo a nuevo.
    return recent.reverse();
  },
});
