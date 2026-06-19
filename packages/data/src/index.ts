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
