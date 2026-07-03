import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { internalMutation } from './_generated/server';

const STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
/** Salas por corrida — mantiene cada ejecucion del cron liviana; se pone al dia en corridas sucesivas. */
const BATCH_SIZE = 20;

async function purgeRoom(ctx: MutationCtx, roomId: Id<'rooms'>) {
  const players = await ctx.db.query('players').withIndex('by_room', (q) => q.eq('roomId', roomId)).collect();
  for (const p of players) await ctx.db.delete(p._id);

  const rounds = await ctx.db.query('rounds').withIndex('by_room', (q) => q.eq('roomId', roomId)).collect();
  for (const round of rounds) {
    const assignments = await ctx.db.query('assignments').withIndex('by_round', (q) => q.eq('roundId', round._id)).collect();
    for (const a of assignments) await ctx.db.delete(a._id);

    const clues = await ctx.db.query('clues').withIndex('by_round', (q) => q.eq('roundId', round._id)).collect();
    for (const c of clues) {
      const reactions = await ctx.db.query('reactions').withIndex('by_clue', (q) => q.eq('clueId', c._id)).collect();
      for (const r of reactions) await ctx.db.delete(r._id);
      await ctx.db.delete(c._id);
    }

    const votes = await ctx.db.query('votes').withIndex('by_round', (q) => q.eq('roundId', round._id)).collect();
    for (const v of votes) await ctx.db.delete(v._id);

    await ctx.db.delete(round._id);
  }

  const messages = await ctx.db.query('messages').withIndex('by_room', (q) => q.eq('roomId', roomId)).collect();
  for (const m of messages) await ctx.db.delete(m._id);

  const liveReactions = await ctx.db.query('liveReactions').withIndex('by_room', (q) => q.eq('roomId', roomId)).collect();
  for (const r of liveReactions) await ctx.db.delete(r._id);

  await ctx.db.delete(roomId);
}

/**
 * Borra salas (y todo lo que cuelga de ellas: jugadores, rondas, asignaciones,
 * pistas, reacciones, votos, mensajes) con más de 30 dias de antiguedad.
 * No toca `stats` (progreso del jugador, debe persistir) ni `reports`
 * (registro de moderacion, se conserva para revision manual) ni `tournaments`.
 * Corre por lotes acotados via cron diario (ver crons.ts) — se pone al dia
 * solo en corridas sucesivas si hay mucho acumulado.
 */
export const purgeOldRooms = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_MS;
    // Orden ascendente por defecto (mas viejas primero); cortamos apenas
    // encontramos una sala que ya no es vieja, porque el resto tampoco lo es.
    const oldest = await ctx.db.query('rooms').order('asc').take(BATCH_SIZE);
    let purged = 0;
    for (const room of oldest) {
      if (room.createdAt >= cutoff) break;
      await purgeRoom(ctx, room._id);
      purged++;
    }
    return { purged };
  },
});
