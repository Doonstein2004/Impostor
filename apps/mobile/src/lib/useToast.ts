import { create } from 'zustand';
import { friendlyError } from './errors';

export type ToastVariant = 'error' | 'info' | 'success';

interface ToastState {
  message: string | null;
  variant: ToastVariant;
  /** Cambia en cada show para reiniciar el auto-dismiss aunque el texto se repita. */
  seq: number;
  show: (message: string, variant?: ToastVariant) => void;
  clear: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  variant: 'info',
  seq: 0,
  show: (message, variant = 'info') => set((s) => ({ message, variant, seq: s.seq + 1 })),
  clear: () => set({ message: null }),
}));

/** Helpers para disparar toasts desde cualquier lado (sin hook). */
export const toast = {
  error: (m: string) => useToast.getState().show(m, 'error'),
  info: (m: string) => useToast.getState().show(m, 'info'),
  success: (m: string) => useToast.getState().show(m, 'success'),
};

/**
 * Ejecuta una mutación y, si falla, muestra un toast con el motivo traducido.
 * Centraliza el manejo de errores de acciones para que nada quede mudo.
 */
export async function runAction(
  fn: () => Promise<unknown>,
  fallback = 'No se pudo completar la acción.',
): Promise<void> {
  try {
    await fn();
  } catch (e) {
    toast.error(friendlyError(e, fallback));
  }
}
