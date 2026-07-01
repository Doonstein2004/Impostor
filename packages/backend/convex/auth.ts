import type { Id } from './_generated/dataModel';

interface Db {
  query: (table: 'players') => any;
}

/**
 * Verifica que `clientId` sea realmente dueño de esa identidad dentro de la sala,
 * comparando el `sessionToken` secreto (nunca expuesto a otros jugadores) contra
 * el guardado en su fila de `players`. clientId por sí solo NO alcanza como prueba
 * de identidad: es visible para todos los demás jugadores de la sala (rooms.get lo
 * devuelve para poder mostrar nombres/host/turnos), así que sin este chequeo
 * cualquiera podría suplantar a otro jugador (incluido el host) con solo conocer
 * su clientId.
 */
export async function assertOwnsIdentity(
  ctx: { db: Db },
  roomId: Id<'rooms'>,
  clientId: string,
  sessionToken: string,
) {
  const player = await ctx.db
    .query('players')
    .withIndex('by_room_client', (q: any) => q.eq('roomId', roomId).eq('clientId', clientId))
    .first();
  if (!player || !player.sessionToken || player.sessionToken !== sessionToken) {
    throw new Error('No autorizado');
  }
  return player;
}
