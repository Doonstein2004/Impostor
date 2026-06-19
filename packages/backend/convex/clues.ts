import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

const ALLOWED_EMOJIS = ['⚽', '🔥', '💀', '😂', '🤔', '👀', '🎯', '❓'];

/** Envía la pista del turno actual. Un jugador, una pista por turno. */
export const submit = mutation({
  args: {
    roundId: v.id('rounds'),
    clientId: v.string(),
    playerName: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { roundId, clientId, playerName, text }) => {
    const round = await ctx.db.get(roundId);
    if (!round || round.status !== 'playing') throw new Error('La ronda no está en fase de pistas');

    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 1) throw new Error('La pista no puede estar vacía');
    if (trimmed.length > 60) throw new Error('La pista es muy larga (máx. 60 caracteres)');

    // Idempotente: sobreescribe si el jugador ya envió en este turno.
    const currentTurn = round.currentTurn ?? 1;

    const existing = await ctx.db
      .query('clues')
      .withIndex('by_round_client_turn', (q) =>
        q.eq('roundId', roundId).eq('clientId', clientId).eq('turn', currentTurn),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { text: trimmed });
      return existing._id;
    }
    return ctx.db.insert('clues', {
      roundId,
      clientId,
      playerName,
      text: trimmed,
      turn: currentTurn,
    });
  },
});

/** Toggle de reacción emoji en una pista. */
export const react = mutation({
  args: {
    clueId: v.id('clues'),
    reactorClientId: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, { clueId, reactorClientId, emoji }) => {
    if (!ALLOWED_EMOJIS.includes(emoji)) throw new Error('Emoji no permitido');

    const existing = await ctx.db
      .query('reactions')
      .withIndex('by_clue_reactor', (q) =>
        q.eq('clueId', clueId).eq('reactorClientId', reactorClientId),
      )
      .first();

    if (existing) {
      if (existing.emoji === emoji) {
        // Doble tap → quitar reacción
        await ctx.db.delete(existing._id);
      } else {
        // Cambiar reacción
        await ctx.db.patch(existing._id, { emoji });
      }
    } else {
      await ctx.db.insert('reactions', { clueId, reactorClientId, emoji });
    }
  },
});

/** Pistas del turno actual (con conteo de reacciones). Público para todos. */
export const listByRound = query({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get(roundId);
    if (!round) return [];

    const clues = await ctx.db
      .query('clues')
      .withIndex('by_round', (q) => q.eq('roundId', roundId))
      .collect();

    // Agrega reacciones a cada pista
    const withReactions = await Promise.all(
      clues.map(async (clue) => {
        const rxns = await ctx.db
          .query('reactions')
          .withIndex('by_clue', (q) => q.eq('clueId', clue._id))
          .collect();

        const counts: Record<string, number> = {};
        const byMe: Record<string, string> = {}; // clientId (ASCII) → emoji
        for (const r of rxns) {
          counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
          byMe[r.reactorClientId] = r.emoji;
        }
        // Emoji chars can't be Convex field names — return as array instead of object
        return {
          ...clue,
          reactionCounts: Object.entries(counts).map(([emoji, count]) => ({ emoji, count })),
          reactorEmojis: byMe,
        };
      }),
    );

    // Ordena: primero por turno, luego por creación
    return withReactions.sort((a, b) => a.turn - b.turn || a._creationTime - b._creationTime);
  },
});

export const EMOJIS = ALLOWED_EMOJIS;
