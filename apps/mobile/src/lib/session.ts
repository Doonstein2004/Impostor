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
  setName: (name: string) => void;
  setHydrated: () => void;
  setCurrentRoomCode: (code: string | null) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      clientId: makeClientId(),
      name: '',
      hydrated: false,
      currentRoomCode: null,
      setName: (name) => set({ name }),
      setHydrated: () => set({ hydrated: true }),
      setCurrentRoomCode: (code) => set({ currentRoomCode: code }),
    }),
    {
      name: 'impostor-session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ clientId: s.clientId, name: s.name, currentRoomCode: s.currentRoomCode }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
