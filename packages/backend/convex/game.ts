import { filterPool, setupRound, tallyVotes, type GameConfig } from '@impostor/core';
import { CHARACTERS } from '@impostor/data';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
async function upsertStats(
  ctx: any,
  clientId: string,
  name: string,
  wasImpostor: boolean,
  won: boolean,
  wasDetected: boolean,
  guessedSecret: boolean,
  scoreGained: number,
) {
  const existing = await ctx.db
    .query('stats')
    .withIndex('by_client', (q: any) => q.eq('clientId', clientId))
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
}

async function recordStatsForRound(
  ctx: any,
  roomId: string,
  impostorIds: Set<string>,
  innocentsWin: boolean,
  impostorWonGuess: boolean,
  ejectedClientId: string | null | undefined,
) {
  const players = await ctx.db
    .query('players')
    .withIndex('by_room', (q: any) => q.eq('roomId', roomId))
    .collect();

  for (const p of players) {
    const wasImpostor = impostorIds.has(p.clientId);
    const won = wasImpostor ? !innocentsWin || impostorWonGuess : innocentsWin;
    await upsertStats(
      ctx, p.clientId, p.name, wasImpostor, won,
      wasImpostor && ejectedClientId === p.clientId,
      wasImpostor && impostorWonGuess,
      p.score,
    );
  }
}

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

    const compliceAssignment = assignments.find((a) => a.isComplice);
    const roundId = await ctx.db.insert('rounds', {
      roomId,
      secretCharacterId: secret.id,
      impostorClientIds: assignments.filter((a) => a.isImpostor).map((a) => a.playerId),
      compliceClientId: compliceAssignment?.playerId,
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
        isComplice: a.isComplice ?? false,
        knowsImpostorClientId: a.knowsImpostorClientId ?? undefined,
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

    // Mantener el MISMO orden de la primera vuelta: se conserva el orden previo,
    // se quitan los que se fueron y se agregan al final los que se sumaron.
    const prevOrder = round.speakerOrder ?? [];
    const presentIds = new Set(players.map((p) => p.clientId));
    const keptOrder = prevOrder.filter((id) => presentIds.has(id));
    const newcomers = players
      .map((p) => p.clientId)
      .filter((id) => !prevOrder.includes(id));
    const speakerOrder = [...keptOrder, ...newcomers];

    await ctx.db.patch(round._id, {
      currentTurn: (round.currentTurn ?? 1) + 1,
      speakerOrder,
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

    // Para el cómplice: buscar el nombre del jugador impostor para mostrarlo en la carta
    let knowsImpostorName: string | null = null;
    if (assignment.isComplice && assignment.knowsImpostorClientId) {
      const round = await ctx.db.get(roundId);
      if (round) {
        const impostorPlayer = await ctx.db
          .query('players')
          .withIndex('by_room_client', (q) =>
            q.eq('roomId', round.roomId).eq('clientId', assignment.knowsImpostorClientId!),
          )
          .first();
        knowsImpostorName = impostorPlayer?.name ?? null;
      }
    }

    return {
      isImpostor: assignment.isImpostor,
      isComplice: assignment.isComplice ?? false,
      character: shown ?? null,
      hint: assignment.hint ?? null,
      knowsImpostorName,
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
    for (const row of voteRows) {
      if (row.voterClientId !== row.targetClientId) votes[row.voterClientId] = row.targetClientId;
    }
    const tally = tallyVotes(votes);

    const impostors = new Set(round.impostorClientIds);
    const ejected = tally.tie ? null : (tally.topIds[0] ?? null);
    const innocentsWin = ejected !== null && impostors.has(ejected);

    if (innocentsWin) {
      // Impostor fue detectado — le damos una oportunidad de adivinar el personaje antes de repartir puntos
      await ctx.db.patch(round._id, { status: 'impostorGuessing', ejectedClientId: ejected });
      await ctx.db.patch(roomId, { status: 'impostorGuessing' });
    } else {
      // Impostores escaparon — ganan 2 puntos directamente; el cómplice también gana con el equipo
      const compliceClientId = round.compliceClientId ?? null;
      const players = await ctx.db
        .query('players')
        .withIndex('by_room', (q) => q.eq('roomId', roomId))
        .collect();
      for (const p of players) {
        const isTeamImpostor = impostors.has(p.clientId) || p.clientId === compliceClientId;
        if (isTeamImpostor) await ctx.db.patch(p._id, { score: p.score + 2 });
      }
      await ctx.db.patch(round._id, {
        status: 'reveal',
        ejectedClientId: ejected,
        innocentsWin: false,
      });
      await ctx.db.patch(roomId, { status: 'reveal' });
      await recordStatsForRound(ctx, roomId, impostors, false, false, ejected);
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
    const compliceClientId = round.compliceClientId ?? null;
    const config = room.config as GameConfig;

    // Calculamos todos los deltas de score en un solo Map para evitar lecturas stale.
    // El cómplice gana y pierde con el equipo impostor.
    const scoreDeltas = new Map<string, number>(players.map((p) => [p.clientId, 0]));

    for (const p of players) {
      const isImpostor = impostors.has(p.clientId);
      const isComplice = p.clientId === compliceClientId;
      const isTeamImpostor = isImpostor || isComplice;
      if (impostorWonGuess && isTeamImpostor) {
        scoreDeltas.set(p.clientId, 2);
      } else if (!impostorWonGuess && !isTeamImpostor) {
        scoreDeltas.set(p.clientId, 1);
      }
    }

    // Penalidad por votar mal: -1 al inocente que votó a otro inocente.
    // El cómplice está exento (es equipo impostor aunque parezca inocente).
    if (!impostorWonGuess && config.penaltyWrongVote) {
      const voteRows = await ctx.db
        .query('votes')
        .withIndex('by_round', (q) => q.eq('roundId', roundId))
        .collect();
      for (const vote of voteRows) {
        const voterIsTeamImpostor = impostors.has(vote.voterClientId) || vote.voterClientId === compliceClientId;
        const targetIsImpostor = impostors.has(vote.targetClientId);
        if (!voterIsTeamImpostor && !targetIsImpostor && vote.voterClientId !== vote.targetClientId) {
          scoreDeltas.set(vote.voterClientId, (scoreDeltas.get(vote.voterClientId) ?? 0) - 1);
        }
      }
    }

    // Aplicar todos los deltas en un único pase (score nunca baja de 0)
    const playerMap = new Map(players.map((p) => [p.clientId, p]));
    for (const [cId, delta] of scoreDeltas) {
      if (delta === 0) continue;
      const p = playerMap.get(cId);
      if (p) await ctx.db.patch(p._id, { score: Math.max(0, p.score + delta) });
    }

    await ctx.db.patch(round._id, {
      status: 'reveal',
      innocentsWin: !impostorWonGuess,
      impostorWonGuess,
    });
    await ctx.db.patch(round.roomId, { status: 'reveal' });
    // Registrar stats de todos los jugadores
    await recordStatsForRound(
      ctx, round.roomId, impostors, !impostorWonGuess, impostorWonGuess, round.ejectedClientId,
    );
  },
});

/** Revancha inmediata: vuelve al lobby y arranca la siguiente ronda sin parar. */
export const quickRematch = mutation({
  args: { roomId: v.id('rooms'), clientId: v.string() },
  handler: async (ctx, { roomId, clientId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error('Sala no encontrada');
    if (room.hostClientId !== clientId) throw new Error('Sólo el host puede iniciar la revancha');
    if (room.status !== 'reveal') throw new Error('Solo se puede revanchar desde el reveal');

    const players = await ctx.db
      .query('players')
      .withIndex('by_room', (q) => q.eq('roomId', roomId))
      .collect();
    if (players.length < 3) throw new Error('Se necesitan al menos 3 jugadores');

    const config = room.config as GameConfig;
    const basePool = filterPool(CHARACTERS, config);
    if (basePool.length === 0) throw new Error('No hay personajes para esta configuración');

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

    const compliceAssignmentQ = assignments.find((a) => a.isComplice);
    const roundId = await ctx.db.insert('rounds', {
      roomId,
      secretCharacterId: secret.id,
      impostorClientIds: assignments.filter((a) => a.isImpostor).map((a) => a.playerId),
      compliceClientId: compliceAssignmentQ?.playerId,
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
        isComplice: a.isComplice ?? false,
        knowsImpostorClientId: a.knowsImpostorClientId ?? undefined,
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
    const abstainedClientIds: string[] = [];
    for (const r of voteRows) {
      if (r.voterClientId === r.targetClientId) {
        abstainedClientIds.push(r.voterClientId);
      } else {
        (votersByTarget[r.targetClientId] ??= []).push(r.voterClientId);
      }
    }

    return {
      impostorClientIds: round.impostorClientIds,
      compliceClientId: round.compliceClientId ?? null,
      secretCharacterId: round.secretCharacterId,
      secretCharacter: charById.get(round.secretCharacterId) ?? null,
      ejectedClientId: round.ejectedClientId ?? null,
      innocentsWin: round.innocentsWin ?? false,
      impostorWonGuess: round.impostorWonGuess ?? null,
      votersByTarget,
      totalVotes: voteRows.length - abstainedClientIds.length,
      abstainedClientIds,
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
