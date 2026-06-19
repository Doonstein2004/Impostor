/**
 * Generador / ampliador del dataset de personajes.
 *
 * Estrategia de la plantilla: el dataset que se bundlea (src/players.ts) es CURADO
 * y versionado, para que el juego funcione 100% offline y sin costos recurrentes.
 * Este script ayuda a expandirlo a partir de fuentes públicas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FUENTES RECOMENDADAS (todas con datos de nombres/posición/nacionalidad):
 *
 *  1. TheSportsDB        https://www.thesportsdb.com/api.php
 *     - API gratuita (key de prueba "3"), jugadores + equipos + fotos.
 *     - Ideal para "actuales". Endpoint: /searchplayers.php?p=Messi
 *
 *  2. Dataset FIFA (Kaggle)  https://www.kaggle.com/datasets (buscar "FIFA players")
 *     - CSV con miles de jugadores: nombre, posición, club, nacionalidad, overall.
 *     - Mapear posición -> zone (GK->portero, CB/LB/RB->defensor, CM/CDM->medio, ST/LW/RW->atacante).
 *     - Ideal para poblar "actuales/experimentados" en masa.
 *
 *  3. FBref / StatsBomb open data  https://github.com/statsbomb/open-data
 *     - Datos históricos para "leyendas/antiguos/modernos".
 *
 *  4. API-Football (de pago)  https://www.api-football.com
 *     - Solo si en el futuro querés un modo "actualizado en vivo".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTA LEGAL: usá fuentes con licencia abierta o de uso permitido. Evitá scrapear
 * sitios que lo prohíban en sus términos (p. ej. Transfermarkt). Para un juego de
 * adivinanzas basta con nombre + posición + época: son datos factuales.
 *
 * USO:
 *   pnpm data:generate            # imprime estadísticas del dataset actual
 *   (extendé mapFifaRow / fetchFromSportsDB según tu fuente y escribí en players.ts)
 */
import { CHARACTERS, countsByCategory } from '../src/index';

function main() {
  const counts = countsByCategory();
  console.log(`Dataset actual: ${CHARACTERS.length} personajes\n`);
  console.log('Por zona:', counts.byZone);
  console.log('Por época:', counts.byEra);
  console.log('Por rol:', counts.byRole);
  console.log(
    '\nPara ampliar: implementá un fetch a TheSportsDB o parseá un CSV de Kaggle,\n' +
      'mapeá las posiciones a zones y agregá las filas a src/players.ts.',
  );
}

main();
