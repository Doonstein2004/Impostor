/**
 * Taxonomía de categorías para filtrar el pool de personajes (jugadores y DTs).
 * Un personaje pertenece a UNA zona, UNA época, UN rol y puede tener varios "tags".
 */

/** Zona / posición en la cancha. */
export const ZONES = ['portero', 'defensor', 'medio', 'atacante'] as const;
export type Zone = (typeof ZONES)[number];

/** Época / generación del personaje. */
export const ERAS = [
  'antiguo', // pre-1990
  'leyenda', // íconos históricos de cualquier época
  'moderno', // ~1990-2010
  'experimentado', // veteranos aún en activo o recién retirados
  'actual', // jugando hoy
  'joven_promesa', // sub-21 destacados
] as const;
export type Era = (typeof ERAS)[number];

/** Rol del personaje dentro del fútbol. */
export const ROLES = ['jugador', 'dt'] as const;
export type Role = (typeof ROLES)[number];

export const ZONE_LABELS: Record<Zone, string> = {
  portero: 'Porteros',
  defensor: 'Defensores',
  medio: 'Mediocampistas',
  atacante: 'Atacantes',
};

export const ERA_LABELS: Record<Era, string> = {
  antiguo: 'Antiguos',
  leyenda: 'Leyendas',
  moderno: 'Modernos',
  experimentado: 'Experimentados',
  actual: 'Actuales',
  joven_promesa: 'Jóvenes promesas',
};

export const ROLE_LABELS: Record<Role, string> = {
  jugador: 'Jugadores',
  dt: 'DTs',
};
