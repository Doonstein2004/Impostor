/** Texto crudo de un error desconocido. */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Traduce los errores del backend (Convex) a un mensaje claro en español para
 * el jugador. Si no reconoce el error, usa `fallback`.
 */
export function friendlyError(e: unknown, fallback: string): string {
  const msg = errorMessage(e);
  if (/no encontrada/i.test(msg)) return 'No existe una sala con ese código.';
  if (/ya empez/i.test(msg)) return 'Esa partida ya empezó.';
  if (/no puede expulsarse/i.test(msg)) return 'No te podés expulsar a vos mismo.';
  if (/host puede/i.test(msg)) return 'Solo el host puede hacer eso.';
  if (/no se puede configurar/i.test(msg)) return 'No se puede cambiar la config con la partida en curso.';
  if (/votación no está abierta/i.test(msg)) return 'La votación ya se cerró.';
  if (/no está en fase de pistas/i.test(msg)) return 'Ya no es momento de dar pistas.';
  if (/no hay ronda activa|ronda no encontrada/i.test(msg)) return 'La ronda ya no está activa.';
  if (/no hay adivinanza/i.test(msg)) return 'La adivinanza ya se resolvió.';
  if (/impostor expulsado o el host/i.test(msg)) return 'Solo el impostor o el host pueden resolver esto.';
  if (/vacía|muy larga/i.test(msg)) return msg; // mensajes de validación ya son claros
  return fallback;
}
