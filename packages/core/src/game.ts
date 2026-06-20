import { ERA_LABELS, ZONE_LABELS } from './categories';
import type { Character, GameConfig, RoleAssignment, RoundSetup } from './types';

/** Fuente de aleatoriedad inyectable (para tests deterministas). */
export type Rng = () => number;

const defaultRng: Rng = Math.random;

function pickRandom<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Filtra el dataset según la configuración de la partida. Listas vacías = sin filtro. */
export function filterPool(all: readonly Character[], config: GameConfig): Character[] {
  return all.filter((c) => {
    if (config.zones.length && !config.zones.includes(c.zone)) return false;
    if (config.eras.length && !config.eras.includes(c.era)) return false;
    if (config.roles.length && !config.roles.includes(c.role)) return false;
    if (config.clubs?.length && (!c.club || !config.clubs.includes(c.club))) return false;
    return true;
  });
}

/** Personaje "similar" al secreto: misma zona y época, distinto id. */
function findSimilar(secret: Character, pool: readonly Character[], rng: Rng): Character | null {
  const candidates = pool.filter(
    (c) => c.id !== secret.id && c.zone === secret.zone && c.era === secret.era,
  );
  if (candidates.length) return pickRandom(candidates, rng);
  const fallback = pool.filter((c) => c.id !== secret.id && c.zone === secret.zone);
  return fallback.length ? pickRandom(fallback, rng) : null;
}

function hintFor(secret: Character): string {
  return `${ZONE_LABELS[secret.zone]} · ${ERA_LABELS[secret.era]}`;
}

export interface SetupRoundArgs {
  playerIds: string[];
  pool: Character[];
  config: GameConfig;
  rng?: Rng;
}

/**
 * Reparte una ronda: elige el personaje secreto, designa impostores y arma
 * lo que ve cada jugador. Pensado para correr en el servidor (Convex).
 */
export function setupRound({ playerIds, pool, config, rng = defaultRng }: SetupRoundArgs): RoundSetup {
  if (pool.length === 0) {
    throw new Error('El pool de personajes está vacío para esta configuración.');
  }
  const maxImpostors = Math.max(1, Math.min(config.impostorCount, playerIds.length - 1));
  const secret = pickRandom(pool, rng);
  const similar = config.impostorHint === 'similar' ? findSimilar(secret, pool, rng) : null;

  const shuffled = shuffle(playerIds, rng);
  const impostorIds = new Set(shuffled.slice(0, maxImpostors));

  const assignments: RoleAssignment[] = playerIds.map((playerId) => {
    const isImpostor = impostorIds.has(playerId);
    if (!isImpostor) {
      return { playerId, isImpostor: false, shownCharacter: secret };
    }
    switch (config.impostorHint) {
      case 'similar':
        return { playerId, isImpostor: true, shownCharacter: similar };
      case 'pista':
        return { playerId, isImpostor: true, shownCharacter: null, hint: hintFor(secret) };
      case 'nada':
      default:
        return { playerId, isImpostor: true, shownCharacter: null };
    }
  });

  return { secret, assignments };
}

export interface VoteTally {
  /** playerId -> votos recibidos. */
  counts: Record<string, number>;
  /** Jugador(es) más votado(s). */
  topIds: string[];
  /** true si hay empate en el primer lugar. */
  tie: boolean;
}

/** Cuenta los votos. `votes` es voterId -> targetId. */
export function tallyVotes(votes: Record<string, string>): VoteTally {
  const counts: Record<string, number> = {};
  for (const target of Object.values(votes)) {
    counts[target] = (counts[target] ?? 0) + 1;
  }
  let max = 0;
  for (const n of Object.values(counts)) max = Math.max(max, n);
  const topIds = Object.entries(counts)
    .filter(([, n]) => n === max && max > 0)
    .map(([id]) => id);
  return { counts, topIds, tie: topIds.length > 1 };
}

/** Genera un código de sala legible (sin caracteres ambiguos). */
export function generateRoomCode(rng: Rng = defaultRng): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(rng() * alphabet.length)];
  return code;
}
