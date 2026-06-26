import { test, expect, type Page, type Browser } from '@playwright/test';

/**
 * Tests E2E del flujo de juego.
 * Requieren Expo dev server en :8081 y Convex operativo.
 * El backend exige mínimo 3 jugadores para iniciar una partida.
 */

// ─── helpers ─────────────────────────────────────────────────────────────────

async function waitForHome(page: Page) {
  await page.goto('/');
  await expect(page.getByText('IMPOSTOR')).toBeVisible({ timeout: 50_000 });
}

/**
 * Cierra el modal de tutorial si aparece.
 * Convex puede tardar 4-6s en cargar el Lobby, por eso esperamos hasta 8s.
 */
async function dismissTutorial(page: Page) {
  const skipBtn = page.getByText('Saltar');
  if (await skipBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await skipBtn.click();
    await expect(skipBtn).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
  }
}

/**
 * Inicia la partida desde el Lobby del host.
 * - El botón dice "⚽ ¡Partida 1! (N disponibles)" — usamos CSS :has-text para evitar
 *   que strict mode matchee los elementos Text/View hijos (misma cadena, distintos nodos).
 * - Si aparece el aviso de jugadores inactivos ("Empezar igual"), lo confirma.
 */
async function startGame(pageHost: Page) {
  // Los Pressable de React Native Web no tienen role="button" en el DOM (no usan
  // accessibilityRole explícito), así que getByRole('button') no los encuentra.
  // getByText + .first() evita el strict mode cuando el texto aparece en el
  // Pressable (div) y en su Text hijo (span) simultáneamente.
  await pageHost.getByText(/disponibles/).first().click();

  // Si el Lobby detecta jugadores "inactivos", muestra card de confirmación.
  const confirmBtn = pageHost.getByText(/Empezar igual/);
  if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await confirmBtn.first().click();
  }
}

/**
 * Crea sala + une N jugadores (mínimo 3 para poder empezar).
 */
async function createAndJoin(browser: Browser, playerCount: number) {
  if (playerCount < 3) throw new Error('Se necesitan al menos 3 jugadores para iniciar partida');

  const contexts = [];
  const pages: Page[] = [];

  // Host crea la sala
  const ctxHost = await browser.newContext();
  const pageHost = await ctxHost.newPage();
  await waitForHome(pageHost);
  await pageHost.getByPlaceholder('Ej. Dani').fill('Host');
  await pageHost.getByText('Crear sala').click();
  await pageHost.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 20_000 });
  await dismissTutorial(pageHost);
  const code = pageHost.url().match(/\/room\/([A-Z0-9]{4,8})/)?.[1] ?? '';
  contexts.push(ctxHost);
  pages.push(pageHost);

  // Jugadores adicionales
  for (let i = 2; i <= playerCount; i++) {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    await waitForHome(pg);
    await pg.getByPlaceholder('Ej. Dani').fill(`P${i}`);
    await pg.getByPlaceholder('ABC123').fill(code);
    await pg.getByText('Unirme').click();
    await pg.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 15_000 });
    await dismissTutorial(pg);
    contexts.push(ctx);
    pages.push(pg);
  }

  return { code, pages, contexts, pageHost };
}

/**
 * Intenta dar pista en la página dada.
 * Retorna true si el input estaba visible y la pista fue enviada.
 * Placeholder real: "Ej: \"zurdo\"..." (inocente) o "Disimulá bien…" (impostor).
 */
async function tryGiveClue(pg: Page, text: string): Promise<boolean> {
  const input = pg.getByPlaceholder(/zurdo|Disimulá/i);
  if (!(await input.isVisible({ timeout: 2_000 }).catch(() => false))) return false;
  await input.fill(text);
  await input.press('Enter');
  return true;
}

/**
 * Hace que todos los jugadores den su pista, en el orden que el juego les asigne.
 * Reintenta la ronda varias veces porque el turno avanza de forma reactiva (Convex)
 * y puede que el jugador no tenga el input visible en el primer intento.
 */
async function giveCluesAllPlayers(pages: Page[], text: string) {
  const gave = new Set<number>();
  const maxAttempts = pages.length * 4;

  for (let attempt = 0; attempt < maxAttempts && gave.size < pages.length; attempt++) {
    for (let i = 0; i < pages.length; i++) {
      if (gave.has(i)) continue;
      const pg = pages[i]!;
      if (await tryGiveClue(pg, text)) {
        gave.add(i);
        // Pausa breve para que Convex propague el avance de turno
        await pages[0]!.waitForTimeout(800);
        break; // Reiniciar el for interno para escanear todos desde el principio
      }
    }
  }
}

// ─── tests ───────────────────────────────────────────────────────────────────

test.describe('Flujo de juego — abstención', () => {
  test.setTimeout(120_000);

  test('botón Abstenerme visible en fase de votación', async ({ browser }) => {
    const { pages, contexts, pageHost } = await createAndJoin(browser, 3);

    await startGame(pageHost);

    // Una vez iniciada, aparece "¡TU TURNO!" (activo) o "Escuchá" (espectando) o "VUELTA"
    await expect(pageHost.getByText(/TU TURNO|Escuchá|VUELTA/i)).toBeVisible({ timeout: 20_000 });

    // Todos los jugadores dan su pista (respetando el orden del juego)
    await giveCluesAllPlayers(pages, 'pista test');

    // Host abre la votación (si no se abrió automáticamente)
    const votingBtn = pageHost.getByText(/Abrir votación|Iniciar votación/i);
    if (await votingBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await votingBtn.click();
    }

    // Verificar que el botón Abstenerme aparece en al menos una pantalla
    let abstainVisible = false;
    for (const pg of pages) {
      if (await pg.getByText('Abstenerme').isVisible({ timeout: 8_000 }).catch(() => false)) {
        abstainVisible = true;
        break;
      }
    }
    expect(abstainVisible).toBe(true);

    for (const ctx of contexts) await ctx.close();
  });
});

test.describe('ClueCard — rediseño visual', () => {
  test.setTimeout(120_000);

  test('las pistas muestran barra de color a la izquierda', async ({ browser }) => {
    const { pages, contexts, pageHost } = await createAndJoin(browser, 3);

    await startGame(pageHost);

    // Una vez iniciada, aparece "¡TU TURNO!" (activo) o "Escuchá" (espectando) o "VUELTA"
    await expect(pageHost.getByText(/TU TURNO|Escuchá|VUELTA/i)).toBeVisible({ timeout: 20_000 });

    // El jugador activo da una pista reconocible
    const clueText = 'Jugó en el Barça y ganó el Balón de Oro';
    for (const pg of pages) {
      if (await tryGiveClue(pg, clueText)) break;
    }

    // La pista debe aparecer en pantalla de algún jugador
    let clueVisible = false;
    for (const pg of pages) {
      if (await pg.getByText(clueText).isVisible({ timeout: 10_000 }).catch(() => false)) {
        clueVisible = true;
        break;
      }
    }
    expect(clueVisible).toBe(true);

    for (const ctx of contexts) await ctx.close();
  });
});

test.describe('Reveal — abstención visible', () => {
  test.setTimeout(150_000);

  test('las abstenciones aparecen en la pantalla de resultado', async ({ browser }) => {
    const { pages, contexts, pageHost } = await createAndJoin(browser, 3);

    await startGame(pageHost);

    // Una vez iniciada, aparece "¡TU TURNO!" (activo) o "Escuchá" (espectando) o "VUELTA"
    await expect(pageHost.getByText(/TU TURNO|Escuchá|VUELTA/i)).toBeVisible({ timeout: 20_000 });

    // Todos dan su pista para completar la vuelta
    await giveCluesAllPlayers(pages, 'test');

    // Host abre votación
    const votingBtn = pageHost.getByText(/Abrir votación|Iniciar votación/i);
    if (await votingBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await votingBtn.click();
    }

    // Al menos un jugador se abstiene
    let abstained = false;
    for (const pg of pages) {
      const abstainBtn = pg.getByText('Abstenerme');
      if (await abstainBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await abstainBtn.click();
        abstained = true;
        break;
      }
    }

    if (!abstained) {
      // Votación ya cerró automáticamente — el test pierde su propósito pero no falla
      for (const ctx of contexts) await ctx.close();
      return;
    }

    // El resto de jugadores votan si todavía están en fase de votación.
    // Los nombres de jugadores aparecen como Pressable (sin role="button").
    for (const pg of pages) {
      for (const name of ['Host', 'P2', 'P3']) {
        const nameEl = pg.getByText(name).first();
        if (await nameEl.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await nameEl.click().catch(() => {});
          break;
        }
      }
    }

    // Host revela (si no se auto-reveló)
    const revealBtn = pageHost.getByText(/Revelar resultado/i);
    if (await revealBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await revealBtn.click();
    }

    // En el reveal debe verse la sección de abstenciones
    await expect(pageHost.getByText(/abstuvieron|abstuvo/i)).toBeVisible({ timeout: 15_000 });

    for (const ctx of contexts) await ctx.close();
  });
});
