import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameConfig } from '@impostor/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { defaultColorKey } from './avatars';

/** Genera un id de cliente estable por dispositivo (sin login en v1). */
function makeClientId(): string {
  return `c_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Un preset de configuración guardado por el host (reglas favoritas). */
export interface ConfigPreset {
  id: string;
  name: string;
  config: GameConfig;
}

interface SessionState {
  clientId: string;
  name: string;
  /** Color de avatar elegido (key de la paleta). */
  avatarColor: string;
  hydrated: boolean;
  currentRoomCode: string | null;
  /**
   * Token secreto de la sala actual (devuelto por create/join/joinAsSpectator).
   * Prueba que este dispositivo es dueño de `clientId` en esa sala; se manda junto
   * al clientId en las acciones sensibles (host, carta secreta, voto) para que
   * nadie pueda suplantar a otro jugador con solo conocer su clientId público.
   */
  sessionToken: string | null;
  tutorialSeen: boolean;
  /** Presets de configuración guardados por el usuario. */
  configPresets: ConfigPreset[];
  /** Mensaje "flash" para mostrar al volver al home (ej. "Te expulsaron"). Transitorio. */
  notice: string | null;
  /** true mientras el jugador sale por su cuenta (para no confundir con expulsión). Transitorio. */
  leaving: boolean;
  setName: (name: string) => void;
  setAvatarColor: (color: string) => void;
  setHydrated: () => void;
  setCurrentRoomCode: (code: string | null) => void;
  setSessionToken: (token: string | null) => void;
  setTutorialSeen: () => void;
  savePreset: (name: string, config: GameConfig) => void;
  deletePreset: (id: string) => void;
  setNotice: (notice: string | null) => void;
  setLeaving: (leaving: boolean) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => {
      const clientId = makeClientId();
      return {
        clientId,
        name: '',
        avatarColor: defaultColorKey(clientId),
        hydrated: false,
        currentRoomCode: null,
        sessionToken: null,
        tutorialSeen: false,
        configPresets: [],
        notice: null,
        leaving: false,
        setName: (name) => set({ name }),
        setAvatarColor: (avatarColor) => set({ avatarColor }),
        setHydrated: () => set({ hydrated: true }),
        setCurrentRoomCode: (code) => set({ currentRoomCode: code }),
        setSessionToken: (sessionToken) => set({ sessionToken }),
        setTutorialSeen: () => set({ tutorialSeen: true }),
        savePreset: (name, config) =>
          set({
            configPresets: [
              ...get().configPresets,
              { id: `p_${Math.random().toString(36).slice(2)}`, name, config },
            ].slice(-12),
          }),
        deletePreset: (id) =>
          set({ configPresets: get().configPresets.filter((p) => p.id !== id) }),
        setNotice: (notice) => set({ notice }),
        setLeaving: (leaving) => set({ leaving }),
      };
    },
    {
      name: 'impostor-session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        clientId: s.clientId,
        name: s.name,
        avatarColor: s.avatarColor,
        currentRoomCode: s.currentRoomCode,
        sessionToken: s.sessionToken,
        tutorialSeen: s.tutorialSeen,
        configPresets: s.configPresets,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
