import type { Character, Era, Role, Zone } from '@impostor/core';
import { CHARACTERS } from './players';

export { CHARACTERS };

/** Total de personajes en el dataset. */
export const CHARACTER_COUNT = CHARACTERS.length;

/** Devuelve los personajes que matchean cualquiera de los filtros (vacío = todos). */
export function queryCharacters(filters: {
  zones?: Zone[];
  eras?: Era[];
  roles?: Role[];
}): Character[] {
  const { zones = [], eras = [], roles = [] } = filters;
  return CHARACTERS.filter((c) => {
    if (zones.length && !zones.includes(c.zone)) return false;
    if (eras.length && !eras.includes(c.era)) return false;
    if (roles.length && !roles.includes(c.role)) return false;
    return true;
  });
}

/**
 * Algunos personajes (sobre todo DTs) tienen una selección nacional en `club`.
 * Las excluimos de la lista de clubes seleccionables del lobby.
 */
const NATIONAL_TEAMS = new Set<string>([
  'Argentina', 'Brasil', 'Uruguay', 'España', 'Portugal', 'Francia', 'Alemania',
  'Italia', 'Inglaterra', 'Países Bajos', 'Colombia', 'México', 'URSS', 'Hungría',
  'Irlanda del Norte', 'Croacia', 'Bélgica', 'Chile', 'Polonia',
]);

/** Clubes con al menos `minCount` personajes, para ofrecerlos como filtro en el lobby. */
export function popularClubs(minCount = 3): string[] {
  const counts: Record<string, number> = {};
  for (const c of CHARACTERS) {
    if (!c.club || NATIONAL_TEAMS.has(c.club)) continue;
    counts[c.club] = (counts[c.club] ?? 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([club]) => club);
}

/** Lista precomputada de clubes seleccionables (>= 3 personajes). */
export const SELECTABLE_CLUBS = popularClubs();

/** Conteo por categoría, útil para mostrar disponibilidad en el lobby. */
export function countsByCategory() {
  const byZone: Record<string, number> = {};
  const byEra: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  for (const c of CHARACTERS) {
    byZone[c.zone] = (byZone[c.zone] ?? 0) + 1;
    byEra[c.era] = (byEra[c.era] ?? 0) + 1;
    byRole[c.role] = (byRole[c.role] ?? 0) + 1;
  }
  return { byZone, byEra, byRole };
}
