import type { Era, Role, Zone } from './categories';

/** Un personaje del dataset (jugador o DT). */
export interface Character {
  id: string;
  /** Nombre mostrado en juego (ej. "Messi"). */
  name: string;
  /** Nombre completo, para la ficha. */
  fullName: string;
  nationality: string;
  zone: Zone;
  era: Era;
  role: Role;
  /** Club más representativo (pista opcional para el modo "con ayuda"). */
  club?: string;
  /** Etiquetas libres para futuros filtros (ej. "balon_de_oro"). */
  tags?: string[];
}

/** Configuración de la partida elegida por el host en el lobby. */
export interface GameConfig {
  /** Zonas incluidas en el pool. Vacío = todas. */
  zones: Zone[];
  /** Épocas incluidas en el pool. Vacío = todas. */
  eras: Era[];
  /** Roles incluidos en el pool. Vacío = todas. */
  roles: Role[];
  /** Clubes incluidos en el pool (por nombre exacto). Vacío = todos. */
  clubs?: string[];
  /** Cantidad de impostores en la partida. */
  impostorCount: number;
  /**
   * Qué recibe el impostor:
   * - 'nada': no sabe el personaje.
   * - 'pista': recibe solo la zona/época como pista.
   * - 'similar': recibe otro personaje parecido (misma zona+época).
   */
  impostorHint: 'nada' | 'pista' | 'similar';
  /** Segundos por turno de pista (0 = sin límite). */
  turnSeconds: number;
  /** Cantidad de rondas de la sesión (0 = sin límite). */
  maxRounds: number;
  /** Vueltas de pistas por partida (0 = sin límite). */
  maxClueRounds?: number;
  /** Segundos para la fase de votación (0 = sin límite). */
  voteSeconds?: number;
  /**
   * Modo de comunicación durante la partida:
   * - 'texto': chat escrito en la sala.
   * - 'audio': sala de audio (LiveKit, pendiente de implementar).
   */
  commMode?: 'texto' | 'audio';
}

export const DEFAULT_CONFIG: GameConfig = {
  zones: [],
  eras: [],
  roles: ['jugador', 'dt'],
  clubs: [],
  impostorCount: 1,
  impostorHint: 'nada',
  turnSeconds: 30,
  maxRounds: 3,
  maxClueRounds: 3,
  voteSeconds: 60,
  commMode: 'texto',
};

export type RoomStatus = 'lobby' | 'playing' | 'voting' | 'impostorGuessing' | 'reveal' | 'finished';

/** Lo que se reparte a cada jugador al iniciar la ronda. */
export interface RoleAssignment {
  playerId: string;
  isImpostor: boolean;
  /** Personaje secreto que ve el jugador (los inocentes ven el real). */
  shownCharacter: Character | null;
  /** Pista textual para el impostor cuando impostorHint === 'pista'. */
  hint?: string;
}

/** Resultado del reparto de una ronda. */
export interface RoundSetup {
  secret: Character;
  assignments: RoleAssignment[];
}
