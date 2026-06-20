import { filterPool, setupRound, tallyVotes, type GameConfig } from '@impostor/core';
import { CHARACTERS } from '@impostor/data';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

const charById = new Map(CHARACTERS.map((c) => [c.id, c]));

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ─── Iniciar ronda ────────────────────────────────────────────────────────────

export const startRound = mutation({
  args: { roomId: v.id('rooms'), clientId: v.string() },
  handler: async (ctx, { roomId, clientId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error('Sala no encontrada');
    if (room.hostClientId !== clientId) throw new Error('Sólo el host puede iniciar');

    const players = await ctx.db
      .query('players')
      .withIndex('by_room', (q) => q.eq('roomId', roomId))
      .collect();
    if (players.length < 3) throw new Error('Se necesitan al menos 3 jugadores');

    const config = room.config as GameConfig;
    const basePool = filterPool(CHARACTERS, config);
    if (basePool.length === 0) throw new Error('No hay personajes para esta configuración');

    // Excluir personajes ya usados en la sesión; si se agotó el pool, reiniciarlo
    const usedIds = new Set(room.usedCharacterIds ?? []);
    const freshPool = basePool.filter((c) => !usedIds.has(c.id));
    const pool = freshPool.length > 0 ? freshPool : basePool;
    const shouldResetUsed = freshPool.length === 0;

    const { secret, assignments } = setupRound({
      playerIds: players.map((p) => p.clientId),
      pool,
      config,
    });

    const speakerOrder = shuffleArr(players.map((p) => p.clientId));

    const roundId = await ctx.db.insert('rounds', {
      roomId,
      secretCharacterId: secret.id,
      impostorClientIds: assignments.filter((a) => a.isImpostor).map((a) => a.playerId),
      status: 'playing',
      currentTurn: 1,
      speakerOrder,
      currentSpeakerIndex: 0,
      turnStartedAt: Date.now(),
      startedAt: Date.now(),
    });

    for (const a of assignments) {
      await ctx.db.insert('assignments', {
        roundId,
        clientId: a.playerId,
        isImpostor: a.isImpostor,
        shownCharacterId: a.shownCharacter?.id ?? null,
        hint: a.hint,
      });
    }

    const prevUsed = shouldResetUsed ? [] : (room.usedCharacterIds ?? []);
    await ctx.db.patch(roomId, {
      status: 'playing',
      currentRoundId: roundId,
      roundNumber: (room.roundNumber ?? 0) + 1,
      usedCharacterIds: [...prevUsed, secret.id],
    });
    return { roundId };
  },
});

// ─── Enviar pista + avanzar turno ─────────────────────────────────────────────

export const submitClueAndAdvance = mutation({
  args: {
    roundId: v.id('rounds'),
    clientId: v.string(),
    playerName: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { roundId, clientId, playerName, text }) => {
    const round = await ctx.db.get(roundId);
    if (!round || round.status !== 'playing') throw new Error('La ronda no está en fase de pistas');

    const speakerOrder = round.speakerOrder ?? [];
    const currentIndex = round.currentSpeakerIndex ?? 0;
    const currentSpeaker = speakerOrder[currentIndex];

    if (currentSpeaker !== clientId) throw new Error('No es tu turno');

    const trimmed = text.trim();
    if (!trimmed) throw new Error('La pista no puede estar vacía');
    if (trimmed.length > 60) throw new Error('Máx. 60 caracteres');

    const currentTurn = round.currentTurn ?? 1;

    // Upsert de la pista
    const existing = await ctx.db
      .query('clues')
      .withIndex('by_round_client_turn', (q) =>
        q.eq('roundId', roundId).eq('clientId', clientId).eq('turn', currentTurn),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { text: trimmed });
    } else {
      await ctx.db.insert('clues', { roundId, clientId, playerName, text: trimmed, turn: currentTurn });
    }

    // Avanzar al siguiente hablante
    const nextIndex = currentIndex + 1;
    await ctx.db.patch(round._id, {
      currentSpeakerIndex: nextIndex,
      turnStartedAt: nextIndex < speakerOrder.length ? Date.now() : round.turnStartedAt,
    });
  },
});

// ─── Saltar turno (timeout o host) ────────────────────────────────────────────

export const skipSpeaker = mutation({
  args: { roundId: v.id('rounds'), clientId: v.string() },
  handler: async (ctx, { roundId, clientId }) => {
    const round = await ctx.db.get(roundId);
    if (!round || round.status !== 'playing') throw new Error('Ronda no activa');

    const speakerOrder = round.speakerOrder ?? [];
    const currentIndex = round.currentSpeakerIndex ?? 0;
    if (currentIndex >= speakerOrder.length) return; // ya terminó la vuelta

    const currentSpeaker = speakerOrder[currentIndex]!;
    const room = await ctx.db.get(round.roomId);

    // Sólo el hablante actual o el host pueden saltar
    if (currentSpeaker !== clientId && room?.hostClientId !== clientId) {
      throw new Error('No podés saltar este turno');
    }

    const nextIndex = currentIndex + 1;
    await ctx.db.patch(round._id, {
      currentSpeakerIndex: nextIndex,
      turnStartedAt: nextIndex < speakerOrder.length ? Date.now() : round.turnStartedAt,
    });
  },
});

// ─── Nueva vuelta de pistas ───────────────────────────────────────────────────

export const nextClueRound = mutation({
  args: { roomId: v.id('rooms'), clientId: v.string() },
  handler: async (ctx, { roomId, clientId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || !room.currentRoundId) throw new Error('No hay ronda activa');
    if (room.hostClientId !== clientId) throw new Error('Sólo el host puede avanzar');

    const round = await ctx.db.get(room.currentRoundId);
    if (!round) throw new Error('Ronda no encontrada');

    const players = await ctx.db
      .query('players')
      .withIndex('by_room', (q) => q.eq('roomId', roomId))
      .collect();

    await ctx.db.patch(round._id, {
      currentTurn: (round.currentTurn ?? 1) + 1,
      speakerOrder: shuffleArr(players.map((p) => p.clientId)),
      currentSpeakerIndex: 0,
      turnStartedAt: Date.now(),
    });
  },
});

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Info pública de la ronda incluyendo quién habla ahora. */
export const getRound = query({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get(roundId);
    if (!round) return null;

    const speakerOrder = round.speakerOrder ?? [];
    const currentIndex = round.currentSpeakerIndex ?? 0;
    const allSpoke = currentIndex >= speakerOrder.length;

    return {
      currentTurn: round.currentTurn ?? 1,
      status: round.status,
      speakerOrder,
      currentSpeakerIndex: currentIndex,
      currentSpeakerId: allSpoke ? null : (speakerOrder[currentIndex] ?? null),
      allSpoke,
      turnStartedAt: round.turnStartedAt ?? Date.now(),
      votingStartedAt: round.votingStartedAt ?? null,
    };
  },
});

/** Carta privada del jugador. */
export const getMyCard = query({
  args: { roundId: v.id('rounds'), clientId: v.string() },
  handler: async (ctx, { roundId, clientId }) => {
    const assignment = await ctx.db
      .query('assignments')
      .withIndex('by_round_client', (q) => q.eq('roundId', roundId).eq('clientId', clientId))
      .first();
    if (!assignment) return null;

    const shown = assignment.shownCharacterId ? charById.get(assignment.shownCharacterId) : null;
    return {
      isImpostor: assignment.isImpostor,
      character: shown ?? null,
      hint: assignment.hint ?? null,
    };
  },
});

/** Abre la votación. */
export const startVoting = mutation({
  args: { roomId: v.id('rooms'), clientId: v.string() },
  handler: async (ctx, { roomId, clientId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || !room.currentRoundId) throw new Error('No hay ronda activa');
    if (room.hostClientId !== clientId) throw new Error('Sólo el host puede abrir la votación');
    await ctx.db.patch(room.currentRoundId, { status: 'voting', votingStartedAt: Date.now() });
    await ctx.db.patch(roomId, { status: 'voting' });
  },
});

/** Revela resultado. Si el impostor fue detectado, transiciona a impostorGuessing para darle una oportunidad. */
export const reveal = mutation({
  args: { roomId: v.id('rooms'), clientId: v.string() },
  handler: async (ctx, { roomId, clientId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || !room.currentRoundId) throw new Error('No hay ronda activa');
    if (room.hostClientId !== clientId) throw new Error('Sólo el host puede revelar');

    const round = await ctx.db.get(room.currentRoundId);
    if (!round) throw new Error('Ronda no encontrada');

    const voteRows = await ctx.db
      .query('votes')
      .withIndex('by_round', (q) => q.eq('roundId', round._id))
      .collect();
    const votes: Record<string, string> = {};
    for (const row of voteRows) votes[row.voterClientId] = row.targetClientId;
    const tally = tallyVotes(votes);

    const impostors = new Set(round.impostorClientIds);
    const ejected = tally.tie ? null : (tally.topIds[0] ?? null);
    const innocentsWin = ejected !== null && impostors.has(ejected);

    if (innocentsWin) {
      // Impostor fue detectado — le damos una oportunidad de adivinar el personaje antes de repartir puntos
      await ctx.db.patch(round._id, { status: 'impostorGuessing', ejectedClientId: ejected });
      await ctx.db.patch(roomId, { status: 'impostorGuessing' });
    } else {
      // Impostores escaparon — ganan 2 puntos directamente
      const players = await ctx.db
        .query('players')
        .withIndex('by_room', (q) => q.eq('roomId', roomId))
        .collect();
      for (const p of players) {
        if (impostors.has(p.clientId)) await ctx.db.patch(p._id, { score: p.score + 2 });
      }
      await ctx.db.patch(round._id, {
        status: 'reveal',
        ejectedClientId: ejected,
        innocentsWin: false,
      });
      await ctx.db.patch(roomId, { status: 'reveal' });
    }
  },
});

/** El impostor detectado intenta adivinar el personaje secreto. También puede ser forzado por el host (guess vacío = error). */
export const submitImpostorGuess = mutation({
  args: { roundId: v.id('rounds'), clientId: v.string(), guess: v.string() },
  handler: async (ctx, { roundId, clientId, guess }) => {
    const round = await ctx.db.get(roundId);
    if (!round || round.status !== 'impostorGuessing') throw new Error('No hay adivinanza activa');

    const room = await ctx.db.get(round.roomId);
    if (!room) throw new Error('Sala no encontrada');

    const isEjected = round.ejectedClientId === clientId;
    const isHost = room.hostClientId === clientId;
    if (!isEjected && !isHost) throw new Error('Solo el impostor expulsado o el host pueden resolver');

    const secret = charById.get(round.secretCharacterId);
    const norm = (s: string) =>
      s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    const trimmed = guess.trim();
    const impostorWonGuess =
      trimmed.length > 0 &&
      (norm(trimmed) === norm(secret?.name ?? '') ||
        norm(trimmed) === norm(secret?.fullName ?? ''));

    const players = await ctx.db
      .query('players')
      .withIndex('by_room', (q) => q.eq('roomId', round.roomId))
      .collect();

    const impostors = new Set(round.impostorClientIds);
    for (const p of players) {
      const isImpostor = impostors.has(p.clientId);
      if (impostorWonGuess && isImpostor) await ctx.db.patch(p._id, { score: p.score + 2 });
      if (!impostorWonGuess && !isImpostor) await ctx.db.patch(p._id, { score: p.score + 1 });
    }

    await ctx.db.patch(round._id, {
      status: 'reveal',
      innocentsWin: !impostorWonGuess,
      impostorWonGuess,
    });
    await ctx.db.patch(round.roomId, { status: 'reveal' });
  },
});

/** Vuelve al lobby. Con `newSession: true` reinicia scores, usedCharacterIds y roundNumber. */
export const backToLobby = mutation({
  args: { roomId: v.id('rooms'), clientId: v.string(), newSession: v.optional(v.boolean()) },
  handler: async (ctx, { roomId, clientId, newSession }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error('Sala no encontrada');
    if (room.hostClientId !== clientId) throw new Error('Sólo el host puede reiniciar');

    if (newSession) {
      const players = await ctx.db
        .query('players')
        .withIndex('by_room', (q) => q.eq('roomId', roomId))
        .collect();
      for (const p of players) await ctx.db.patch(p._id, { score: 0 });
      await ctx.db.patch(roomId, {
        status: 'lobby',
        currentRoundId: undefined,
        roundNumber: 0,
        usedCharacterIds: [],
      });
    } else {
      await ctx.db.patch(roomId, { status: 'lobby', currentRoundId: undefined });
    }
  },
});

/** Estado del reveal (roles + jugador secreto). */
export const getReveal = query({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get(roundId);
    if (!round || round.status !== 'reveal') return null;

    // Detalle de votos: cuántos recibió cada jugador y quién votó por él.
    const voteRows = await ctx.db
      .query('votes')
      .withIndex('by_round', (q) => q.eq('roundId', roundId))
      .collect();
    const votersByTarget: Record<string, string[]> = {};
    for (const r of voteRows) {
      (votersByTarget[r.targetClientId] ??= []).push(r.voterClientId);
    }

    return {
      impostorClientIds: round.impostorClientIds,
      secretCharacterId: round.secretCharacterId,
      secretCharacter: charById.get(round.secretCharacterId) ?? null,
      ejectedClientId: round.ejectedClientId ?? null,
      innocentsWin: round.innocentsWin ?? false,
      impostorWonGuess: round.impostorWonGuess ?? null,
      votersByTarget,
      totalVotes: voteRows.length,
    };
  },
});

/** Estado de la fase de adivinanza del impostor. */
export const getImpostorGuessState = query({
  args: { roundId: v.id('rounds') },
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get(roundId);
    if (!round || round.status !== 'impostorGuessing') return null;
    return {
      ejectedClientId: round.ejectedClientId ?? null,
      impostorClientIds: round.impostorClientIds,
    };
  },
});
