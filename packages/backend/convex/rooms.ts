import { DEFAULT_CONFIG, generateRoomCode } from '@impostor/core';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { gameConfigValidator } from './schema';

/** Crea una sala nueva y agrega al host como primer jugador. */
export const create = mutation({
  args: { clientId: v.string(), name: v.string() },
  handler: async (ctx, { clientId, name }) => {
    // Genera un código único (reintenta ante colisión, muy improbable).
    let code = generateRoomCode();
    for (let i = 0; i < 5; i++) {
      const existing = await ctx.db
        .query('rooms')
        .withIndex('by_code', (q) => q.eq('code', code))
        .first();
      if (!existing) break;
      code = generateRoomCode();
    }

    const roomId = await ctx.db.insert('rooms', {
      code,
      hostClientId: clientId,
      status: 'lobby',
      config: DEFAULT_CONFIG,
      createdAt: Date.now(),
    });

    await ctx.db.insert('players', {
      roomId,
      clientId,
      name,
      isHost: true,
      connected: true,
      score: 0,
      joinedAt: Date.now(),
    });

    return { roomId, code };
  },
});

/** Une a un jugador a una sala por código. Idempotente por clientId. */
export const join = mutation({
  args: { code: v.string(), clientId: v.string(), name: v.string() },
  handler: async (ctx, { code, clientId, name }) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
      .first();
    if (!room) throw new Error('Sala no encontrada');
    if (room.status !== 'lobby') throw new Error('La partida ya empezó');

    const existing = await ctx.db
      .query('players')
      .withIndex('by_room_client', (q) => q.eq('roomId', room._id).eq('clientId', clientId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { connected: true, name });
      return { roomId: room._id, code: room.code };
    }

    await ctx.db.insert('players', {
      roomId: room._id,
      clientId,
      name,
      isHost: false,
      connected: true,
      score: 0,
      joinedAt: Date.now(),
    });
    return { roomId: room._id, code: room.code };
  },
});

/** El jugador abandona la sala. Si era el host, transfiere el host al siguiente. */
export const leave = mutation({
  args: { roomId: v.id('rooms'), clientId: v.string() },
  handler: async (ctx, { roomId, clientId }) => {
    const player = await ctx.db
      .query('players')
      .withIndex('by_room_client', (q) => q.eq('roomId', roomId).eq('clientId', clientId))
      .first();
    if (!player) return;
    await ctx.db.delete(player._id);

    const room = await ctx.db.get(roomId);
    if (!room) return;

    const remaining = await ctx.db
      .query('players')
      .withIndex('by_room', (q) => q.eq('roomId', roomId))
      .collect();

    if (remaining.length === 0) {
      await ctx.db.delete(roomId);
      return;
    }
    if (room.hostClientId === clientId) {
      const next = remaining.sort((a, b) => a.joinedAt - b.joinedAt)[0]!;
      await ctx.db.patch(roomId, { hostClientId: next.clientId });
      await ctx.db.patch(next._id, { isHost: true });
    }
  },
});

/** El host expulsa a un jugador de la sala (no puede expulsarse a sí mismo). */
export const kick = mutation({
  args: { roomId: v.id('rooms'), hostClientId: v.string(), targetClientId: v.string() },
  handler: async (ctx, { roomId, hostClientId, targetClientId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error('Sala no encontrada');
    if (room.hostClientId !== hostClientId) throw new Error('Sólo el host puede expulsar');
    if (targetClientId === hostClientId) throw new Error('El host no puede expulsarse a sí mismo');

    const player = await ctx.db
      .query('players')
      .withIndex('by_room_client', (q) => q.eq('roomId', roomId).eq('clientId', targetClientId))
      .first();
    if (!player) return;
    await ctx.db.delete(player._id);
  },
});

/** Actualiza el estado de conexión y actividad del jugador. */
export const updatePresence = mutation({
  args: { roomId: v.id('rooms'), clientId: v.string(), connected: v.boolean() },
  handler: async (ctx, { roomId, clientId, connected }) => {
    const player = await ctx.db
      .query('players')
      .withIndex('by_room_client', (q) => q.eq('roomId', roomId).eq('clientId', clientId))
      .first();
    if (!player) return;
    await ctx.db.patch(player._id, { connected, lastActiveAt: Date.now() });
  },
});

/** El host actualiza la configuración de la partida (sólo en lobby). */
export const updateConfig = mutation({
  args: { roomId: v.id('rooms'), clientId: v.string(), config: gameConfigValidator },
  handler: async (ctx, { roomId, clientId, config }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error('Sala no encontrada');
    if (room.hostClientId !== clientId) throw new Error('Sólo el host puede configurar');
    if (room.status !== 'lobby') throw new Error('No se puede configurar en partida');
    await ctx.db.patch(roomId, { config });
  },
});

/** Estado PÚBLICO de la sala: jugadores, config y status. Sin roles secretos. */
export const get = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
      .first();
    if (!room) return null;

    const players = await ctx.db
      .query('players')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    return {
      _id: room._id,
      code: room.code,
      status: room.status,
      hostClientId: room.hostClientId,
      config: { ...room.config, maxRounds: room.config.maxRounds ?? 3 },
      usedCharacterIds: room.usedCharacterIds ?? [],
      currentRoundId: room.currentRoundId ?? null,
      roundNumber: room.roundNumber ?? 0,
      players: players
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => ({
          clientId: p.clientId,
          name: p.name,
          isHost: p.isHost,
          connected: p.connected,
          lastActiveAt: p.lastActiveAt,
          score: p.score,
        })),
    };
  },
});
