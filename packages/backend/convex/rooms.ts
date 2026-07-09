import { DEFAULT_CONFIG, generateRoomCode } from '@impostor/core';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { gameConfigValidator } from './schema';
import { assertOwnsIdentity } from './auth';

const MAX_NAME_LEN = 30;
const MAX_SPECTATORS = 20;
/** Rate limit anti-spam: máx salas creadas por el mismo clientId por ventana de tiempo. */
const CREATE_ROOM_RATE_LIMIT_MAX = 5;
const CREATE_ROOM_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/** Token opaco de sesión (no criptográficamente crítico, sólo debe ser no-adivinable). */
function makeSessionToken(): string {
  return crypto.randomUUID();
}

function validateName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new Error('El nombre debe tener al menos 2 caracteres');
  if (trimmed.length > MAX_NAME_LEN) throw new Error(`El nombre es muy largo (máx. ${MAX_NAME_LEN} caracteres)`);
  return trimmed;
}

/** Crea una sala nueva y agrega al host como primer jugador. */
export const create = mutation({
  args: { clientId: v.string(), name: v.string(), color: v.optional(v.string()), password: v.optional(v.string()) },
  handler: async (ctx, { clientId, name, color, password }) => {
    const validName = validateName(name);

    // Rate limit anti-spam: máx N salas por clientId en la ventana de tiempo.
    const windowStart = Date.now() - CREATE_ROOM_RATE_LIMIT_WINDOW_MS;
    const recentByHost = await ctx.db
      .query('rooms')
      .withIndex('by_host', (q) => q.eq('hostClientId', clientId))
      .order('desc')
      .take(20);
    const recentCount = recentByHost.filter((r) => r.createdAt > windowStart).length;
    if (recentCount >= CREATE_ROOM_RATE_LIMIT_MAX) {
      throw new Error('Creaste demasiadas salas en poco tiempo, esperá unos minutos');
    }

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
      ...(password?.trim() ? { password: password.trim() } : {}),
      createdAt: Date.now(),
    });

    const sessionToken = makeSessionToken();
    await ctx.db.insert('players', {
      roomId,
      clientId,
      name: validName,
      isHost: true,
      color,
      sessionToken,
      connected: true,
      score: 0,
      joinedAt: Date.now(),
    });

    return { roomId, code, sessionToken };
  },
});

/** Une a un jugador a una sala por código. Idempotente por clientId. */
export const join = mutation({
  args: { code: v.string(), clientId: v.string(), name: v.string(), color: v.optional(v.string()), password: v.optional(v.string()) },
  handler: async (ctx, { code, clientId, name, color, password }) => {
    const validName = validateName(name);

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
      .first();
    if (!room) throw new Error('Sala no encontrada');

    const existing = await ctx.db
      .query('players')
      .withIndex('by_room_client', (q) => q.eq('roomId', room._id).eq('clientId', clientId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { connected: true, name: validName, ...(color ? { color } : {}) });
      return { roomId: room._id, code: room.code };
    }

    if (room.status !== 'lobby') {
      // Re-ingreso a mitad de partida: si este clientId tiene una asignación en la
      // ronda actual, era parte de esta partida (lo expulsó el auto-kick o se le
      // cerró la app) — dejarlo volver como jugador para que pueda seguir/votar.
      // El score de la sesión se pierde (vivía en la fila borrada); mal menor
      // frente a quedar afuera hasta que termine la ronda.
      const wasInRound = room.currentRoundId
        ? await ctx.db
            .query('assignments')
            .withIndex('by_round_client', (q) =>
              q.eq('roundId', room.currentRoundId!).eq('clientId', clientId),
            )
            .first()
        : null;
      if (!wasInRound) throw new Error('La partida ya empezó');

      const sessionToken = makeSessionToken();
      await ctx.db.insert('players', {
        roomId: room._id,
        clientId,
        name: validName,
        isHost: false,
        color,
        sessionToken,
        connected: true,
        score: 0,
        joinedAt: Date.now(),
      });
      return { roomId: room._id, code: room.code, sessionToken };
    }

    // Validaciones para nuevos jugadores
    if (room.password && password?.trim() !== room.password) {
      throw new Error('Esta sala requiere contraseña');
    }
    const maxPlayers = (room.config.maxPlayers ?? 10) || 10;
    const allPlayers = await ctx.db
      .query('players')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();
    const nonSpectators = allPlayers.filter((p) => !p.isSpectator);
    if (nonSpectators.length >= maxPlayers) {
      throw new Error(`La sala está llena (máx. ${maxPlayers} jugadores)`);
    }

    const sessionToken = makeSessionToken();
    await ctx.db.insert('players', {
      roomId: room._id,
      clientId,
      name: validName,
      isHost: false,
      color,
      sessionToken,
      connected: true,
      score: 0,
      joinedAt: Date.now(),
    });
    return { roomId: room._id, code: room.code, sessionToken };
  },
});

/** Une a alguien como espectador. Funciona en cualquier estado de la sala. */
export const joinAsSpectator = mutation({
  args: { code: v.string(), clientId: v.string(), name: v.string(), color: v.optional(v.string()), password: v.optional(v.string()) },
  handler: async (ctx, { code, clientId, name, color, password }) => {
    const validName = validateName(name);

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code.toUpperCase()))
      .first();
    if (!room) throw new Error('Sala no encontrada');

    const existing = await ctx.db
      .query('players')
      .withIndex('by_room_client', (q) => q.eq('roomId', room._id).eq('clientId', clientId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { connected: true, name: validName, ...(color ? { color } : {}) });
      return { roomId: room._id, code: room.code, isSpectator: existing.isSpectator ?? false };
    }

    // Validaciones para nuevos espectadores
    if (room.password && password?.trim() !== room.password) {
      throw new Error('Esta sala requiere contraseña');
    }

    // Límite de espectadores para evitar flooding
    const allPlayers = await ctx.db
      .query('players')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();
    const spectatorCount = allPlayers.filter((p) => p.isSpectator).length;
    if (spectatorCount >= MAX_SPECTATORS) {
      throw new Error(`La sala ya tiene demasiados espectadores (máx. ${MAX_SPECTATORS})`);
    }

    const sessionToken = makeSessionToken();
    await ctx.db.insert('players', {
      roomId: room._id,
      clientId,
      name: validName,
      isHost: false,
      isSpectator: true,
      color,
      sessionToken,
      connected: true,
      score: 0,
      joinedAt: Date.now(),
    });
    return { roomId: room._id, code: room.code, isSpectator: true, sessionToken };
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
  args: {
    roomId: v.id('rooms'),
    hostClientId: v.string(),
    hostSessionToken: v.string(),
    targetClientId: v.string(),
  },
  handler: async (ctx, { roomId, hostClientId, hostSessionToken, targetClientId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error('Sala no encontrada');
    if (room.hostClientId !== hostClientId) throw new Error('Sólo el host puede expulsar');
    await assertOwnsIdentity(ctx, roomId, hostClientId, hostSessionToken);
    if (targetClientId === hostClientId) throw new Error('El host no puede expulsarse a sí mismo');

    const player = await ctx.db
      .query('players')
      .withIndex('by_room_client', (q) => q.eq('roomId', roomId).eq('clientId', targetClientId))
      .first();
    if (!player) return;
    await ctx.db.delete(player._id);
  },
});

/** El jugador cambia su nombre y/o color de avatar mientras está en una sala. */
export const updateProfile = mutation({
  args: {
    roomId: v.id('rooms'),
    clientId: v.string(),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, clientId, name, color }) => {
    const player = await ctx.db
      .query('players')
      .withIndex('by_room_client', (q) => q.eq('roomId', roomId).eq('clientId', clientId))
      .first();
    if (!player) return;
    const patch: { name?: string; color?: string } = {};
    if (name !== undefined) {
      const trimmedName = name.trim();
      if (trimmedName.length < 2) throw new Error('El nombre debe tener al menos 2 caracteres');
      if (trimmedName.length > MAX_NAME_LEN) throw new Error(`El nombre es muy largo (máx. ${MAX_NAME_LEN} caracteres)`);
      patch.name = trimmedName;
    }
    if (color) patch.color = color;
    if (Object.keys(patch).length > 0) await ctx.db.patch(player._id, patch);
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
    // Ya NO se auto-expulsa a nadie por desconexión (ver tanda 30 en CLAUDE.md):
    // el timer (bajado de 3 a 10 min en tanda 27) seguía expulsando a jugadores
    // reales en partidas presenciales sin avisarles por qué, y sin forma de volver
    // a tiempo. El host ya tiene "SALTAR TURNO" (para el turno de alguien
    // desconectado) y expulsar a mano (✕) — cubren el mismo caso sin el riesgo de
    // sacar a alguien que solo bloqueó la pantalla un rato.
  },
});

/** El host actualiza la configuración de la partida (sólo en lobby). */
export const updateConfig = mutation({
  args: { roomId: v.id('rooms'), clientId: v.string(), sessionToken: v.string(), config: gameConfigValidator },
  handler: async (ctx, { roomId, clientId, sessionToken, config }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error('Sala no encontrada');
    if (room.hostClientId !== clientId) throw new Error('Sólo el host puede configurar');
    await assertOwnsIdentity(ctx, roomId, clientId, sessionToken);
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
      hasPassword: !!room.password,
      currentRoundId: room.currentRoundId ?? null,
      roundNumber: room.roundNumber ?? 0,
      players: players
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => ({
          clientId: p.clientId,
          name: p.name,
          isHost: p.isHost,
          isSpectator: p.isSpectator ?? false,
          color: p.color ?? null,
          connected: p.connected,
          lastActiveAt: p.lastActiveAt,
          score: p.score,
        })),
    };
  },
});

/** El host establece o borra la contraseña de la sala (solo en lobby). */
export const updatePassword = mutation({
  args: { roomId: v.id('rooms'), clientId: v.string(), sessionToken: v.string(), password: v.optional(v.string()) },
  handler: async (ctx, { roomId, clientId, sessionToken, password }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error('Sala no encontrada');
    if (room.hostClientId !== clientId) throw new Error('Solo el host puede cambiar la contraseña');
    await assertOwnsIdentity(ctx, roomId, clientId, sessionToken);
    if (room.status !== 'lobby') throw new Error('No se puede cambiar en partida');
    const trimmed = password?.trim() ?? '';
    if (trimmed.length > 50) throw new Error('La contraseña es muy larga (máx. 50 caracteres)');
    await ctx.db.patch(roomId, { password: trimmed || '' });
  },
});
