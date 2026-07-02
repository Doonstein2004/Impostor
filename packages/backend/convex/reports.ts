import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { assertOwnsIdentity } from './auth';

const MAX_CONTEXT_LEN = 300;

const reasonValidator = v.union(
  v.literal('acoso'),
  v.literal('lenguaje_inapropiado'),
  v.literal('spam'),
  v.literal('contenido_sexual'),
  v.literal('otro'),
);

/** Reporta a otro jugador de la sala por su conducta en el chat o la sala de audio. */
export const submit = mutation({
  args: {
    roomId: v.id('rooms'),
    clientId: v.string(),
    sessionToken: v.string(),
    reportedClientId: v.string(),
    reason: reasonValidator,
    context: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, clientId, sessionToken, reportedClientId, reason, context }) => {
    if (clientId === reportedClientId) throw new Error('No podés reportarte a vos mismo');

    const reporter = await assertOwnsIdentity(ctx, roomId, clientId, sessionToken);

    const room = await ctx.db.get(roomId);
    if (!room) throw new Error('La sala no existe');

    const reported = await ctx.db
      .query('players')
      .withIndex('by_room_client', (q) => q.eq('roomId', roomId).eq('clientId', reportedClientId))
      .first();
    if (!reported) throw new Error('Ese jugador ya no está en la sala');

    await ctx.db.insert('reports', {
      roomId,
      roomCode: room.code,
      reporterClientId: clientId,
      reporterName: reporter.name,
      reportedClientId,
      reportedName: reported.name,
      reason,
      context: context?.trim().slice(0, MAX_CONTEXT_LEN) || undefined,
      createdAt: Date.now(),
    });
  },
});
