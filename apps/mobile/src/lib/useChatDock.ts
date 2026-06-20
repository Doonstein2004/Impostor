import { create } from 'zustand';

/**
 * Alto real (en px) que ocupa la barra de chat acoplada abajo. Las pantallas de
 * juego lo leen para reservar ese espacio y que el chat nunca tape los controles.
 * En modo panel lateral (web ancho) vale 0.
 */
interface ChatDockState {
  height: number;
  setHeight: (h: number) => void;
}

export const useChatDock = create<ChatDockState>((set) => ({
  height: 0,
  setHeight: (height) => set({ height }),
}));

/** Padding inferior recomendado para dejar espacio al chat (alto real + colchón). */
export function useChatInset(extra = 16): number {
  return useChatDock((s) => s.height) + extra;
}
