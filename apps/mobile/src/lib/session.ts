import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Genera un id de cliente estable por dispositivo (sin login en v1). */
function makeClientId(): string {
  return `c_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

interface SessionState {
  clientId: string;
  name: string;
  hydrated: boolean;
  currentRoomCode: string | null;
  /** Mensaje "flash" para mostrar al volver al home (ej. "Te expulsaron"). Transitorio. */
  notice: string | null;
  /** true mientras el jugador sale por su cuenta (para no confundir con expulsión). Transitorio. */
  leaving: boolean;
  setName: (name: string) => void;
  setHydrated: () => void;
  setCurrentRoomCode: (code: string | null) => void;
  setNotice: (notice: string | null) => void;
  setLeaving: (leaving: boolean) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      clientId: makeClientId(),
      name: '',
      hydrated: false,
      currentRoomCode: null,
      notice: null,
      leaving: false,
      setName: (name) => set({ name }),
      setHydrated: () => set({ hydrated: true }),
      setCurrentRoomCode: (code) => set({ currentRoomCode: code }),
      setNotice: (notice) => set({ notice }),
      setLeaving: (leaving) => set({ leaving }),
    }),
    {
      name: 'impostor-session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ clientId: s.clientId, name: s.name, currentRoomCode: s.currentRoomCode }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
