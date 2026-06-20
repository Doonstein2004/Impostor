import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

const MAX_LEN = 300;
/** Cuántos mensajes recientes se devuelven al cliente. */
const HISTORY_LIMIT = 80;

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
