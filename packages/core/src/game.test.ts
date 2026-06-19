import { describe, expect, it } from 'vitest';
import { filterPool, generateRoomCode, setupRound, tallyVotes } from './game';
import type { Character, GameConfig } from './types';

/** RNG determinista para tests. */
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const pool: Character[] = [
  { id: '1', name: 'A', fullName: 'A', nationality: 'AR', zone: 'atacante', era: 'leyenda', role: 'jugador' },
  { id: '2', name: 'B', fullName: 'B', nationality: 'BR', zone: 'atacante', era: 'leyenda', role: 'jugador' },
  { id: '3', name: 'C', fullName: 'C', nationality: 'ES', zone: 'portero', era: 'actual', role: 'jugador' },
  { id: '4', name: 'D', fullName: 'D', nationality: 'IT', zone: 'defensor', era: 'antiguo', role: 'dt' },
];

const config: GameConfig = {
  zones: [],
  eras: [],
  roles: [],
  impostorCount: 1,
  impostorHint: 'nada',
  turnSeconds: 0,
  maxRounds: 0,
};

describe('filterPool', () => {
  it('filtra por zona', () => {
    expect(filterPool(pool, { ...config, zones: ['atacante'] }).map((c) => c.id)).toEqual(['1', '2']);
  });
  it('filtra por rol', () => {
    expect(filterPool(pool, { ...config, roles: ['dt'] }).map((c) => c.id)).toEqual(['4']);
  });
});

describe('setupRound', () => {
  it('asigna exactamente impostorCount impostores', () => {
    const { assignments } = setupRound({
      playerIds: ['p1', 'p2', 'p3', 'p4'],
      pool,
      config: { ...config, impostorCount: 2 },
      rng: seededRng(7),
    });
    expect(assignments.filter((a) => a.isImpostor)).toHaveLength(2);
  });

  it('los inocentes ven el personaje secreto, el impostor no', () => {
    const { secret, assignments } = setupRound({
      playerIds: ['p1', 'p2'],
      pool,
      config,
      rng: seededRng(3),
    });
    for (const a of assignments) {
      if (a.isImpostor) expect(a.shownCharacter).toBeNull();
      else expect(a.shownCharacter?.id).toBe(secret.id);
    }
  });

  it('siempre deja al menos un inocente', () => {
    const { assignments } = setupRound({
      playerIds: ['p1', 'p2'],
      pool,
      config: { ...config, impostorCount: 5 },
      rng: seededRng(1),
    });
    expect(assignments.filter((a) => !a.isImpostor).length).toBeGreaterThanOrEqual(1);
  });
});

describe('tallyVotes', () => {
  it('detecta empates', () => {
    const t = tallyVotes({ a: 'x', b: 'y' });
    expect(t.tie).toBe(true);
    expect(t.topIds.sort()).toEqual(['x', 'y']);
  });
  it('detecta ganador único', () => {
    const t = tallyVotes({ a: 'x', b: 'x', c: 'y' });
    expect(t.tie).toBe(false);
    expect(t.topIds).toEqual(['x']);
  });
});

describe('generateRoomCode', () => {
  it('genera 6 caracteres sin ambiguos', () => {
    const code = generateRoomCode(seededRng(42));
    expect(code).toHaveLength(6);
    expect(code).not.toMatch(/[OI01]/);
  });
});
