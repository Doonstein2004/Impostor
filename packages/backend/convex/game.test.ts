/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import schema from './schema';
import { api } from './_generated/api';

const modules = import.meta.glob('./**/*.ts');

// ─── helpers ────────────────────────────────────────────────────────────────

const BASE_CONFIG = {
  zones: [] as ('portero' | 'defensor' | 'medio' | 'atacante')[],
  eras: [] as ('antiguo' | 'leyenda' | 'moderno' | 'experimentado' | 'actual' | 'joven_promesa')[],
  roles: ['jugador', 'dt'] as ('jugador' | 'dt')[],
  clubs: [] as string[],
  impostorCount: 1,
  impostorHint: 'nada' as const,
  turnSeconds: 0,
  maxRounds: 1,
  maxClueRounds: 1,
  voteSeconds: 0,
  commMode: 'texto' as const,
  penaltyWrongVote: false,
  maxPlayers: 10,
};

/** Crea sala con 3 jugadores y arranca una ronda. Devuelve { code, roomId, roundId, players, tokens }. */
async function setupGame(t: ReturnType<typeof convexTest>) {
  const { code, roomId, sessionToken: hostToken } = await t.mutation(api.rooms.create, {
    clientId: 'host',
    name: 'Host',
  });

  const { sessionToken: p2Token } = await t.mutation(api.rooms.join, { code, clientId: 'p2', name: 'P2' });
  const { sessionToken: p3Token } = await t.mutation(api.rooms.join, { code, clientId: 'p3', name: 'P3' });
  const tokens: Record<string, string> = { host: hostToken, p2: p2Token ?? '', p3: p3Token ?? '' };

  await t.mutation(api.rooms.updateConfig, {
    roomId,
    clientId: 'host',
    sessionToken: hostToken,
    config: BASE_CONFIG,
  });

  await t.mutation(api.game.startRound, { roomId, clientId: 'host', sessionToken: hostToken });

  const room = await t.query(api.rooms.get, { code });
  const roundId = room!.currentRoundId!;
  const players = room!.players;

  return { code, roomId, roundId, players, tokens };
}

// ─── abstención en votación ──────────────────────────────────────────────────

describe('game.reveal — abstención (self-vote)', () => {
  it('la abstención no cuenta en el tally y no elige expulsado', async () => {
    const t = convexTest(schema, modules);
    const { roomId, roundId, players, tokens } = await setupGame(t);

    // Dar una pista rápida para poder votar (el backend requiere al menos 1 vuelta).
    const round = await t.query(api.game.getRound, { roundId });
    if (round?.currentSpeakerId) {
      // Cada jugador da su pista (ignoramos errores de turno).
      for (const p of players.filter((p) => !p.isSpectator)) {
        await t.mutation(api.game.submitClueAndAdvance, {
          roundId,
          clientId: p.clientId,
          playerName: p.name,
          text: 'pista de prueba',
        }).catch(() => { /* puede fallar si no es su turno */ });
      }
    }

    await t.mutation(api.game.startVoting, { roomId, clientId: 'host', sessionToken: tokens.host! });

    // Todos se abstienen (votan a sí mismos).
    for (const p of players.filter((pl) => !pl.isSpectator)) {
      await t.mutation(api.votes.cast, {
        roundId,
        voterClientId: p.clientId,
        voterSessionToken: tokens[p.clientId]!,
        targetClientId: p.clientId,
      });
    }

    // Revelar — con todos absteniéndose no hay expulsado.
    await t.mutation(api.game.reveal, { roomId, clientId: 'host', sessionToken: tokens.host! });

    const data = await t.query(api.game.getReveal, { roundId });
    expect(data).not.toBeNull();
    // Sin votos reales, no hay expulsado (tie vacío → ejectedClientId null).
    expect(data!.ejectedClientId).toBeNull();
    // Las abstenciones deben estar en abstainedClientIds.
    expect(data!.abstainedClientIds).toHaveLength(players.filter((p) => !p.isSpectator).length);
    // totalVotes excluye abstenciones.
    expect(data!.totalVotes).toBe(0);
  });

  it('getReveal separa votos reales de abstenciones correctamente', async () => {
    const t = convexTest(schema, modules);
    const { roomId, roundId, tokens } = await setupGame(t);

    await t.mutation(api.game.startVoting, { roomId, clientId: 'host', sessionToken: tokens.host! });

    // p2 abstiene, host y p3 votan a p2.
    await t.mutation(api.votes.cast, {
      roundId, voterClientId: 'p2', voterSessionToken: tokens.p2!, targetClientId: 'p2',
    });
    await t.mutation(api.votes.cast, {
      roundId, voterClientId: 'host', voterSessionToken: tokens.host!, targetClientId: 'p2',
    });
    await t.mutation(api.votes.cast, {
      roundId, voterClientId: 'p3', voterSessionToken: tokens.p3!, targetClientId: 'p2',
    });

    await t.mutation(api.game.reveal, { roomId, clientId: 'host', sessionToken: tokens.host! });
    const data = await t.query(api.game.getReveal, { roundId });

    expect(data!.abstainedClientIds).toEqual(['p2']);
    expect(data!.totalVotes).toBe(2); // host + p3 (no p2)
    expect(data!.votersByTarget['p2']).toEqual(expect.arrayContaining(['host', 'p3']));
    expect(data!.votersByTarget['p2']).not.toContain('p2');
  });
});
