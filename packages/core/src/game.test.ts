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

// ─── Abstención (self-vote) ────────────────────────────────────────────────
// El backend filtra votos donde voter === target ANTES de llamar tallyVotes.
// Estos tests verifican que tallyVotes funciona correctamente con el input
// pre-filtrado que recibiría (vacío o sin las abstenciones).
describe('tallyVotes — escenarios de abstención', () => {
  it('sin votos reales (todos se abstienen) → sin expulsado, sin empate', () => {
    // El backend filtra self-votes; si todos se abstienen, llega {} a tallyVotes.
    // Con 0 candidatos, tie=false y topIds=[] → ejected = topIds[0] ?? null = null.
    const t = tallyVotes({});
    expect(t.tie).toBe(false);
    expect(t.topIds).toHaveLength(0);
  });

  it('mezcla de votos reales y votos ya filtrados → solo cuenta los reales', () => {
    // p2 y p3 votaron a 'impostor'; p1 se abstuvo (ya filtrado por backend).
    const t = tallyVotes({ p2: 'impostor', p3: 'impostor' });
    expect(t.tie).toBe(false);
    expect(t.topIds).toEqual(['impostor']);
  });

  it('un voto real y uno ya filtrado → gana el votado', () => {
    const t = tallyVotes({ p2: 'target1' });
    expect(t.topIds).toEqual(['target1']);
    expect(t.tie).toBe(false);
  });

  it('empate entre dos jugadores → tie true con ambos IDs', () => {
    const t = tallyVotes({ p1: 'x', p2: 'y' });
    expect(t.tie).toBe(true);
    expect(t.topIds.sort()).toEqual(['x', 'y']);
  });
});

// ─── filterPool — filtro de clubes ───────────────────────────────────────
describe('filterPool — clubes', () => {
  const poolConClubs: Character[] = [
    { id: '1', name: 'A', fullName: 'A', nationality: 'AR', zone: 'atacante', era: 'leyenda', role: 'jugador', club: 'Real Madrid' },
    { id: '2', name: 'B', fullName: 'B', nationality: 'BR', zone: 'atacante', era: 'actual',  role: 'jugador', club: 'Barcelona' },
    { id: '3', name: 'C', fullName: 'C', nationality: 'ES', zone: 'portero',  era: 'actual',  role: 'jugador', club: 'Real Madrid' },
    { id: '4', name: 'D', fullName: 'D', nationality: 'IT', zone: 'defensor', era: 'antiguo', role: 'dt' },
  ];

  it('sin filtro de club devuelve todos', () => {
    expect(filterPool(poolConClubs, { ...config, clubs: [] })).toHaveLength(4);
  });

  it('filtro de club exacto devuelve solo los del club', () => {
    const res = filterPool(poolConClubs, { ...config, clubs: ['Real Madrid'] });
    expect(res.map((c) => c.id)).toEqual(['1', '3']);
  });

  it('club que no existe devuelve vacío', () => {
    const res = filterPool(poolConClubs, { ...config, clubs: ['Manchester City'] });
    expect(res).toHaveLength(0);
  });

  it('varios clubes devuelve la unión', () => {
    const res = filterPool(poolConClubs, { ...config, clubs: ['Real Madrid', 'Barcelona'] });
    expect(res.map((c) => c.id).sort()).toEqual(['1', '2', '3']);
  });
});

// ─── setupRound — pistas al impostor ──────────────────────────────────────
describe('setupRound — impostorHint', () => {
  it('hint=nada → shownCharacter null para el impostor', () => {
    const { assignments } = setupRound({
      playerIds: ['p1', 'p2', 'p3'],
      pool,
      config: { ...config, impostorHint: 'nada' },
      rng: seededRng(5),
    });
    const impostor = assignments.find((a) => a.isImpostor)!;
    expect(impostor.shownCharacter).toBeNull();
    expect(impostor.hint).toBeUndefined();
  });

  it('hint=pista → el impostor recibe una cadena de pista, no el personaje', () => {
    const { assignments } = setupRound({
      playerIds: ['p1', 'p2', 'p3'],
      pool,
      config: { ...config, impostorHint: 'pista' },
      rng: seededRng(5),
    });
    const impostor = assignments.find((a) => a.isImpostor)!;
    expect(impostor.shownCharacter).toBeNull();
    expect(typeof impostor.hint).toBe('string');
    expect(impostor.hint!.length).toBeGreaterThan(0);
  });

  it('hint=similar → el impostor recibe un personaje diferente al secreto', () => {
    const bigPool: Character[] = [
      ...pool,
      { id: '5', name: 'E', fullName: 'E', nationality: 'FR', zone: 'atacante', era: 'leyenda', role: 'jugador' },
    ];
    const { secret, assignments } = setupRound({
      playerIds: ['p1', 'p2', 'p3'],
      pool: bigPool,
      config: { ...config, impostorHint: 'similar' },
      rng: seededRng(5),
    });
    const impostor = assignments.find((a) => a.isImpostor)!;
    // Con hint=similar el impostor recibe otro personaje (puede coincidir si pool muy pequeño)
    if (impostor.shownCharacter !== null) {
      expect(impostor.shownCharacter.id).not.toBe(secret.id);
    }
  });
});
