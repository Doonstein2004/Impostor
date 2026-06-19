import type { Id } from '@impostor/backend/dataModel';
import type { GameConfig } from '@impostor/core';

export interface RoomView {
  _id: Id<'rooms'>;
  code: string;
  status: 'lobby' | 'playing' | 'voting' | 'impostorGuessing' | 'reveal' | 'finished';
  hostClientId: string;
  config: GameConfig;
  currentRoundId: Id<'rounds'> | null;
  roundNumber: number;
  usedCharacterIds: string[];
  players: {
    clientId: string;
    name: string;
    isHost: boolean;
    connected: boolean;
    lastActiveAt?: number;
    score: number;
  }[];
}

export const POSITION_COLORS = {
  portero: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40', label: 'POR' },
  defensor: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', label: 'DEF' },
  medio: { bg: 'bg-pitch-500/20', text: 'text-pitch-400', border: 'border-pitch-500/40', label: 'MED' },
  atacante: { bg: 'bg-impostor-500/20', text: 'text-impostor-400', border: 'border-impostor-500/40', label: 'ATK' },
} as const;

export const CLUE_EMOJIS = ['⚽', '🔥', '💀', '😂', '🤔', '👀'];
