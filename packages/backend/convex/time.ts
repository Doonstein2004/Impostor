import { query } from './_generated/server';

/**
 * Hora del servidor (ms UTC). El cliente la usa una vez para calcular el desfase
 * con su reloj local y que el contador no vaya adelantado/atrasado entre dispositivos.
 */
export const now = query({
  args: {},
  handler: async () => Date.now(),
});
