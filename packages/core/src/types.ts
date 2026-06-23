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
  /** Si es true, los jugadores que votan a un inocente pierden 1 punto cuando los inocentes ganan. */
  penaltyWrongVote?: boolean;
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
  penaltyWrongVote: false,
};

/** Un modo de juego predefinido con config y descripción para el lobby. */
export interface GameMode {
  id: string;
  name: string;
  emoji: string;
  /** Una línea que resume el espíritu del modo. */
  description: string;
  /** Bullet points que se muestran cuando el usuario expande el modo. */
  details: string[];
  /** Config parcial que se fusiona con DEFAULT_CONFIG al aplicar. */
  config: Partial<GameConfig>;
}

export const GAME_MODES: GameMode[] = [
  {
    id: 'clasico',
    name: 'Clásico',
    emoji: '⚽',
    description: 'El modo estándar y balanceado.',
    details: [
      '3 vueltas de pistas por partida',
      '30 seg. por turno · 60 seg. para votar',
      '1 impostor · 3 partidas por sesión',
      'Sin penalidad por votos incorrectos',
    ],
    config: {},
  },
  {
    id: 'rapido',
    name: 'Rápido',
    emoji: '⚡',
    description: 'Partidas cortas, decisiones apresuradas.',
    details: [
      '1 vuelta de pistas por partida',
      '20 seg. por turno · 30 seg. para votar',
      'El impostor no recibe ninguna pista',
      'Sesión sin límite de partidas',
    ],
    config: {
      maxClueRounds: 1,
      turnSeconds: 20,
      voteSeconds: 30,
      impostorHint: 'nada',
      maxRounds: 0,
      penaltyWrongVote: false,
    },
  },
  {
    id: 'experto',
    name: 'Experto',
    emoji: '🧠',
    description: 'Dos impostores, sin ayudas y con penalidades.',
    details: [
      '2 impostores trabajando juntos',
      '2 vueltas de pistas · 45 seg. por turno',
      'Sin pistas para los impostores',
      'Penalidad de -1 punto por votar a un inocente',
    ],
    config: {
      impostorCount: 2,
      maxClueRounds: 2,
      turnSeconds: 45,
      voteSeconds: 60,
      impostorHint: 'nada',
      maxRounds: 3,
      penaltyWrongVote: true,
    },
  },
  {
    id: 'relajado',
    name: 'Relajado',
    emoji: '😎',
    description: 'Sin presión de tiempo, con ayuda para el impostor.',
    details: [
      'Sin límite de tiempo por turno ni votación',
      '3 vueltas de pistas por partida',
      'El impostor recibe un personaje similar como pista',
      'Sin penalidad por votos incorrectos',
    ],
    config: {
      turnSeconds: 0,
      voteSeconds: 0,
      maxClueRounds: 3,
      impostorHint: 'similar',
      impostorCount: 1,
      penaltyWrongVote: false,
    },
  },
];

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
