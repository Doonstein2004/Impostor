import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

/** Registra el resultado de una partida para un jugador. Crea o actualiza su fila de stats. */
export const recordGame = mutation({
  args: {
    clientId: v.string(),
    name: v.string(),
    wasImpostor: v.boolean(),
    won: v.boolean(),
    wasDetected: v.optional(v.boolean()),
    guessedSecret: v.optional(v.boolean()),
    scoreGained: v.number(),
  },
  handler: async (ctx, { clientId, name, wasImpostor, won, wasDetected, guessedSecret, scoreGained }) => {
    const existing = await ctx.db
      .query('stats')
      .withIndex('by_client', (q) => q.eq('clientId', clientId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        gamesPlayed: existing.gamesPlayed + 1,
        timesImpostor: existing.timesImpostor + (wasImpostor ? 1 : 0),
        timesInnocent: existing.timesInnocent + (wasImpostor ? 0 : 1),
        impostorWins: existing.impostorWins + (wasImpostor && won ? 1 : 0),
        innocentWins: existing.innocentWins + (!wasImpostor && won ? 1 : 0),
        timesDetected: existing.timesDetected + (wasDetected ? 1 : 0),
        timesGuessedSecret: existing.timesGuessedSecret + (guessedSecret ? 1 : 0),
        totalScore: existing.totalScore + scoreGained,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('stats', {
        clientId,
        name,
        gamesPlayed: 1,
        timesImpostor: wasImpostor ? 1 : 0,
        timesInnocent: wasImpostor ? 0 : 1,
        impostorWins: wasImpostor && won ? 1 : 0,
        innocentWins: !wasImpostor && won ? 1 : 0,
        timesDetected: wasDetected ? 1 : 0,
        timesGuessedSecret: guessedSecret ? 1 : 0,
        totalScore: scoreGained,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Ranking global: top jugadores por partidas ganadas (desempate por win rate
 * y luego puntaje total). Sólo incluye jugadores con al menos 1 partida.
 */
export const top = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const all = await ctx.db.query('stats').collect();
    const rows = all
      .filter((s) => s.gamesPlayed > 0)
      .map((s) => {
        const wins = s.impostorWins + s.innocentWins;
        return {
          clientId: s.clientId,
          name: s.name,
          gamesPlayed: s.gamesPlayed,
          wins,
          totalScore: s.totalScore,
          winRate: Math.round((wins / s.gamesPlayed) * 100),
        };
      })
      .sort((a, b) =>
        b.wins - a.wins ||
        b.winRate - a.winRate ||
        b.totalScore - a.totalScore,
      );
    return rows.slice(0, limit ?? 50);
  },
});

/** Stats de un jugador. */
export const get = query({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    const s = await ctx.db
      .query('stats')
      .withIndex('by_client', (q) => q.eq('clientId', clientId))
      .first();
    if (!s) return null;
    return {
      gamesPlayed: s.gamesPlayed,
      timesImpostor: s.timesImpostor,
      timesInnocent: s.timesInnocent,
      impostorWins: s.impostorWins,
      innocentWins: s.innocentWins,
      timesDetected: s.timesDetected,
      timesGuessedSecret: s.timesGuessedSecret,
      totalScore: s.totalScore,
      winRate: s.gamesPlayed > 0
        ? Math.round(((s.impostorWins + s.innocentWins) / s.gamesPlayed) * 100)
        : 0,
      impostorWinRate: s.timesImpostor > 0
        ? Math.round((s.impostorWins / s.timesImpostor) * 100)
        : 0,
    };
  },
});
