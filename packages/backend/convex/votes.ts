import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { assertOwnsIdentity } from './auth';

/** Registra (o cambia) el voto de un jugador en la ronda activa. */
export const cast = mutation({
  args: {
    roundId: v.id('rounds'),
    voterClientId: v.string(),
    voterSessionToken: v.string(),
    targetClientId: v.string(),
  },
  handler: async (ctx, { roundId, voterClientId, voterSessionToken, targetClientId }) => {
    const round = await ctx.db.get(roundId);
    if (!round || round.status !== 'voting') throw new Error('La votación no está abierta');

    // Solo jugadores activos (no espectadores) pueden votar
    const voter = await assertOwnsIdentity(ctx, round.roomId, voterClientId, voterSessionToken);
    if (voter.isSpectator) throw new Error('No podés votar en esta partida');

    // El objetivo debe ser un jugador activo de esta sala (no un espectador ni un extraño)
    const target = await ctx.db
      .query('players')
      .withIndex('by_room_client', (q) =>
        q.eq('roomId', round.roomId).eq('clientId', targetClientId),
      )
      .first();
    if (!target || target.isSpectator) throw new Error('El objetivo no es un jugador válido');

    const existing = await ctx.db
      .query('votes')
      .withIndex('by_round_voter', (q) =>
        q.eq('roundId', roundId).eq('voterClientId', voterClientId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { targetClientId });
    } else {
      await ctx.db.insert('votes', { roundId, voterClientId, targetClientId });
    }
  },
});

/**
 * Estado de la votación.
 * - `votedClientIds`: quién ya votó (visible para todos).
 * - `votesByVoter`: el voto de CADA votante (el cliente lo usa para resaltar SU voto).
 *   Se expone porque en partidas en tiempo real el secreto del voto es de corta vida;
 *   el reveal completo de totales ocurre en game.reveal.
 */
export const state = query({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, { roundId }) => {
    const rows = await ctx.db
      .query('votes')
      .withIndex('by_round', (q) => q.eq('roundId', roundId))
      .collect();
    const votesByVoter: Record<string, string> = {};
    for (const r of rows) votesByVoter[r.voterClientId] = r.targetClientId;
    return {
      total: rows.length,
      votedClientIds: rows.map((r) => r.voterClientId),
      votesByVoter,
    };
  },
});
