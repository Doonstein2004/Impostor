import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const zoneValidator = v.union(
  v.literal('portero'),
  v.literal('defensor'),
  v.literal('medio'),
  v.literal('atacante'),
);
const eraValidator = v.union(
  v.literal('antiguo'),
  v.literal('leyenda'),
  v.literal('moderno'),
  v.literal('experimentado'),
  v.literal('actual'),
  v.literal('joven_promesa'),
);
const roleValidator = v.union(v.literal('jugador'), v.literal('dt'));

export const gameConfigValidator = v.object({
  zones: v.array(zoneValidator),
  eras: v.array(eraValidator),
  roles: v.array(roleValidator),
  /** Clubes incluidos en el pool (nombre exacto). Vacío = todos. */
  clubs: v.optional(v.array(v.string())),
  impostorCount: v.number(),
  impostorHint: v.union(v.literal('nada'), v.literal('pista'), v.literal('similar')),
  turnSeconds: v.number(),
  maxRounds: v.optional(v.number()),
  /** Vueltas de pistas por partida (0 = sin límite). */
  maxClueRounds: v.optional(v.number()),
  /** Segundos para votar (0 = sin límite). */
  voteSeconds: v.optional(v.number()),
  /** Modo de comunicación: 'texto' (chat) o 'audio' (sala de voz). */
  commMode: v.optional(v.union(v.literal('texto'), v.literal('audio'))),
  /** Penaliza con -1 punto a quien vota por un inocente cuando los inocentes ganan. */
  penaltyWrongVote: v.optional(v.boolean()),
  /** Máximo de jugadores (no espectadores) permitidos en la sala. 0 o ausente = sin límite. */
  maxPlayers: v.optional(v.number()),
});

export const roomStatusValidator = v.union(
  v.literal('lobby'),
  v.literal('playing'),
  v.literal('voting'),
  v.literal('impostorGuessing'),
  v.literal('reveal'),
  v.literal('finished'),
);

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    hostClientId: v.string(),
    status: roomStatusValidator,
    config: gameConfigValidator,
    currentRoundId: v.optional(v.id('rounds')),
    roundNumber: v.optional(v.number()),
    /** IDs de personajes ya usados en esta sesión (para no repetir). */
    usedCharacterIds: v.optional(v.array(v.string())),
    /** Contraseña de la sala. Vacío/ausente = sala pública. */
    password: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_code', ['code']),

  players: defineTable({
    roomId: v.id('rooms'),
    clientId: v.string(),
    name: v.string(),
    isHost: v.boolean(),
    isSpectator: v.optional(v.boolean()),
    /** Clave del color de avatar elegido por el jugador (ver lib/avatars). */
    color: v.optional(v.string()),
    connected: v.boolean(),
    lastActiveAt: v.optional(v.number()),
    score: v.number(),
    joinedAt: v.number(),
  })
    .index('by_room', ['roomId'])
    .index('by_room_client', ['roomId', 'clientId']),

  rounds: defineTable({
    roomId: v.id('rooms'),
    secretCharacterId: v.string(),
    impostorClientIds: v.array(v.string()),
    status: v.union(v.literal('playing'), v.literal('voting'), v.literal('impostorGuessing'), v.literal('reveal')),
    /** Vuelta actual de pistas (empieza en 1). */
    currentTurn: v.optional(v.number()),
    /** Orden de turno de los jugadores para la vuelta actual. */
    speakerOrder: v.optional(v.array(v.string())),
    /** Posición actual en speakerOrder (= speakerOrder.length cuando todos hablaron). */
    currentSpeakerIndex: v.optional(v.number()),
    /** Timestamp UTC en ms de cuando empezó el turno del hablante actual. */
    turnStartedAt: v.optional(v.number()),
    /** Timestamp cuando se abrió la votación. */
    votingStartedAt: v.optional(v.number()),
    /** clientId del jugador más votado (null si hubo empate). */
    ejectedClientId: v.optional(v.union(v.string(), v.null())),
    /** true cuando los inocentes ganaron la ronda. */
    innocentsWin: v.optional(v.boolean()),
    /** true si el impostor adivinó el personaje secreto (null = no se llegó a adivinar). */
    impostorWonGuess: v.optional(v.boolean()),
    startedAt: v.number(),
  }).index('by_room', ['roomId']),

  assignments: defineTable({
    roundId: v.id('rounds'),
    clientId: v.string(),
    isImpostor: v.boolean(),
    shownCharacterId: v.union(v.string(), v.null()),
    hint: v.optional(v.string()),
  })
    .index('by_round', ['roundId'])
    .index('by_round_client', ['roundId', 'clientId']),

  /** Una pista por jugador por turno. */
  clues: defineTable({
    roundId: v.id('rounds'),
    clientId: v.string(),
    playerName: v.string(),
    text: v.string(),
    turn: v.number(),
  })
    .index('by_round', ['roundId'])
    .index('by_round_turn', ['roundId', 'turn'])
    .index('by_round_client_turn', ['roundId', 'clientId', 'turn']),

  /** Reacciones emoji a una pista concreta. */
  reactions: defineTable({
    clueId: v.id('clues'),
    reactorClientId: v.string(),
    emoji: v.string(),
  })
    .index('by_clue', ['clueId'])
    .index('by_clue_reactor', ['clueId', 'reactorClientId']),

  votes: defineTable({
    roundId: v.id('rounds'),
    voterClientId: v.string(),
    targetClientId: v.string(),
  })
    .index('by_round', ['roundId'])
    .index('by_round_voter', ['roundId', 'voterClientId']),

  /** Mensajes del chat de sala (persisten durante toda la sesión de la sala). */
  messages: defineTable({
    roomId: v.id('rooms'),
    clientId: v.string(),
    name: v.string(),
    text: v.string(),
    createdAt: v.number(),
  }).index('by_room', ['roomId']),

  /** Estadísticas acumuladas por jugador (clientId persistente en el dispositivo). */
  stats: defineTable({
    clientId: v.string(),
    name: v.string(),
    gamesPlayed: v.number(),
    timesImpostor: v.number(),
    timesInnocent: v.number(),
    impostorWins: v.number(),
    innocentWins: v.number(),
    timesDetected: v.number(),
    timesGuessedSecret: v.number(),
    totalScore: v.number(),
    updatedAt: v.number(),
  }).index('by_client', ['clientId']),
});
