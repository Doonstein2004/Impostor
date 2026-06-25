import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { gameConfigValidator } from './schema';

// Genera un bracket de eliminación simple para N equipos.
// Si N no es potencia de 2, los equipos de "semilla alta" reciben bye.
function buildEliminationBracket(teamIds: string[]) {
  const n = teamIds.length;
  // Siguiente potencia de 2 >= n
  let slots = 1;
  while (slots < n) slots *= 2;

  const bracket: Array<{
    matchId: string;
    round: number;
    matchNumber: number;
    team1Id?: string;
    team2Id?: string;
    winnerId?: string;
    roomCode?: string;
    team1Score?: number;
    team2Score?: number;
    status: 'pending' | 'playing' | 'finished' | 'bye';
  }> = [];

  // Ronda 1
  let matchNum = 0;
  for (let i = 0; i < slots; i += 2) {
    const t1 = teamIds[i];
    const t2 = teamIds[i + 1];
    const isBye = !t2;
    bracket.push({
      matchId: `r1_m${matchNum}`,
      round: 1,
      matchNumber: matchNum,
      team1Id: t1,
      team2Id: t2,
      winnerId: isBye ? t1 : undefined,
      status: isBye ? 'bye' : 'pending',
    });
    matchNum++;
  }

  // Rondas siguientes (placeholder — se completan cuando avanzan los ganadores)
  const totalRounds = Math.log2(slots);
  for (let r = 2; r <= totalRounds; r++) {
    const matchesInRound = slots / Math.pow(2, r);
    for (let m = 0; m < matchesInRound; m++) {
      bracket.push({
        matchId: `r${r}_m${m}`,
        round: r,
        matchNumber: m,
        status: 'pending',
      });
    }
  }

  return bracket;
}

// Genera bracket round-robin para N equipos.
function buildRoundRobinBracket(teamIds: string[]) {
  const bracket: Array<{
    matchId: string;
    round: number;
    matchNumber: number;
    team1Id?: string;
    team2Id?: string;
    winnerId?: string;
    roomCode?: string;
    team1Score?: number;
    team2Score?: number;
    status: 'pending' | 'playing' | 'finished' | 'bye';
  }> = [];

  let matchNum = 0;
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      bracket.push({
        matchId: `m${matchNum}`,
        round: 1,
        matchNumber: matchNum,
        team1Id: teamIds[i],
        team2Id: teamIds[j],
        status: 'pending',
      });
      matchNum++;
    }
  }
  return bracket;
}

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    hostClientId: v.string(),
    format: v.union(v.literal('elimination'), v.literal('round_robin')),
    teams: v.array(v.object({
      id: v.string(),
      name: v.string(),
      color: v.string(),
    })),
    playerTeams: v.array(v.object({
      clientId: v.string(),
      playerName: v.string(),
      teamId: v.string(),
    })),
    config: gameConfigValidator,
  },
  handler: async (ctx, args) => {
    if (args.teams.length < 2 || args.teams.length > 8) {
      throw new Error('Se necesitan entre 2 y 8 equipos');
    }

    const teamIds = args.teams.map(t => t.id);
    const bracket = args.format === 'elimination'
      ? buildEliminationBracket(teamIds)
      : buildRoundRobinBracket(teamIds);

    const code = randomCode();
    const id = await ctx.db.insert('tournaments', {
      code,
      name: args.name,
      hostClientId: args.hostClientId,
      status: 'setup',
      format: args.format,
      teams: args.teams,
      playerTeams: args.playerTeams,
      bracket,
      config: args.config,
      createdAt: Date.now(),
    });

    return { id, code };
  },
});

export const start = mutation({
  args: { tournamentId: v.id('tournaments'), hostClientId: v.string() },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.tournamentId);
    if (!t) throw new Error('Torneo no encontrado');
    if (t.hostClientId !== args.hostClientId) throw new Error('Solo el host puede iniciar');
    if (t.status !== 'setup') throw new Error('El torneo ya comenzó');
    await ctx.db.patch(args.tournamentId, { status: 'active' });
  },
});

export const recordMatchResult = mutation({
  args: {
    tournamentId: v.id('tournaments'),
    matchId: v.string(),
    team1Score: v.number(),
    team2Score: v.number(),
    roomCode: v.string(),
    hostClientId: v.string(),
  },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.tournamentId);
    if (!t) throw new Error('Torneo no encontrado');
    if (t.hostClientId !== args.hostClientId) throw new Error('Solo el host puede registrar resultados');

    type BracketEntry = (typeof t.bracket)[number];

    const bracket: BracketEntry[] = t.bracket.map(m => {
      if (m.matchId !== args.matchId) return m;
      const winnerId = args.team1Score > args.team2Score
        ? m.team1Id
        : args.team2Score > args.team1Score
          ? m.team2Id
          : undefined; // empate — no avanza nadie (no debería pasar)
      return {
        matchId: m.matchId,
        round: m.round,
        matchNumber: m.matchNumber,
        team1Id: m.team1Id,
        team2Id: m.team2Id,
        team1Score: args.team1Score,
        team2Score: args.team2Score,
        winnerId,
        roomCode: args.roomCode,
        status: 'finished' as const,
      };
    });

    // Para eliminación: avanzar ganador al siguiente match
    if (t.format === 'elimination') {
      const match = bracket.find(m => m.matchId === args.matchId)!;
      if (match.winnerId) {
        const nextRound = match.round + 1;
        const nextMatchIndex = Math.floor(match.matchNumber / 2);
        const nextMatch = bracket.find(m => m.round === nextRound && m.matchNumber === nextMatchIndex);
        if (nextMatch) {
          const slotIsTeam1 = match.matchNumber % 2 === 0;
          const idx = bracket.indexOf(nextMatch);
          const next = nextMatch;
          if (slotIsTeam1) {
            bracket[idx] = {
              matchId: next.matchId, round: next.round, matchNumber: next.matchNumber,
              team1Id: match.winnerId, team2Id: next.team2Id, winnerId: next.winnerId,
              roomCode: next.roomCode, team1Score: next.team1Score, team2Score: next.team2Score,
              status: next.status,
            };
          } else {
            bracket[idx] = {
              matchId: next.matchId, round: next.round, matchNumber: next.matchNumber,
              team1Id: next.team1Id, team2Id: match.winnerId, winnerId: next.winnerId,
              roomCode: next.roomCode, team1Score: next.team1Score, team2Score: next.team2Score,
              status: next.status,
            };
          }
        }
      }
    }

    // Verificar si el torneo terminó
    const allDone = bracket
      .filter(m => m.status !== 'bye')
      .every(m => m.status === 'finished');

    await ctx.db.patch(args.tournamentId, {
      bracket,
      status: allDone ? 'finished' : 'active',
    });
  },
});

export const setMatchRoom = mutation({
  args: {
    tournamentId: v.id('tournaments'),
    matchId: v.string(),
    roomCode: v.string(),
    hostClientId: v.string(),
  },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.tournamentId);
    if (!t) throw new Error('Torneo no encontrado');
    if (t.hostClientId !== args.hostClientId) throw new Error('Solo el host puede gestionar matches');
    const bracket = t.bracket.map(m =>
      m.matchId === args.matchId
        ? { ...m, roomCode: args.roomCode, status: 'playing' as const }
        : m
    );
    await ctx.db.patch(args.tournamentId, { bracket });
  },
});

// ─── Queries ──────────────────────────────────────────────────────────────────

export const get = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('tournaments')
      .withIndex('by_code', q => q.eq('code', args.code))
      .first();
  },
});

export const getById = query({
  args: { id: v.id('tournaments') },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});
