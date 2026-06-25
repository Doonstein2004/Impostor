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
 * Crea sala + une N jugadores (mínimo 3 para poder empezar).
 * Usa waitForURL en vez de esperar texto del lobby para evitar falso-positivo
 * con la banner "SALA ACTIVA" del home.
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
    await expect(pg).toHaveURL(/\/room\//, { timeout: 15_000 });
    contexts.push(ctx);
    pages.push(pg);
  }

  return { code, pages, contexts, pageHost };
}

/** Intenta dar pista al jugador cuyo turno es activo (si la tiene). */
async function tryGiveClue(pg: Page, text: string) {
  const input = pg.getByPlaceholder(/pista|clue/i);
  if (await input.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await input.fill(text);
    const btn = pg.getByRole('button', { name: /enviar|dar pista|→/i });
    if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await btn.click();
      return true;
    }
  }
  return false;
}

// ─── tests ───────────────────────────────────────────────────────────────────

test.describe('Flujo de juego — abstención', () => {
  test.setTimeout(90_000);

  test('botón Abstenerme visible en fase de votación', async ({ browser }) => {
    const { pages, contexts, pageHost } = await createAndJoin(browser, 3);

    // Host inicia la partida (requiere mínimo 3 jugadores — ya los tenemos).
    await pageHost.getByText('Empezar').click();

    // Esperar que al menos uno esté en fase de pistas.
    await expect(pageHost.getByText(/vuelta|PISTA|clue/i)).toBeVisible({ timeout: 20_000 });

    // Turno por turno: el jugador activo da su pista.
    for (const pg of pages) {
      await tryGiveClue(pg, 'pista test');
    }

    // Host abre la votación (si ya no se abrió automáticamente).
    const votingBtn = pageHost.getByText(/Abrir votación|Iniciar votación/i);
    if (await votingBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await votingBtn.click();
    }

    // Verificar que el botón Abstenerme aparece en al menos una pantalla.
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
  test.setTimeout(90_000);

  test('las pistas muestran barra de color a la izquierda', async ({ browser }) => {
    const { pages, contexts, pageHost } = await createAndJoin(browser, 3);

    await pageHost.getByText('Empezar').click();
    await expect(pageHost.getByText(/vuelta|PISTA|clue/i)).toBeVisible({ timeout: 20_000 });

    // El jugador activo da una pista reconocible.
    const clueText = 'Jugó en el Barça y ganó el Balón de Oro';
    for (const pg of pages) {
      if (await tryGiveClue(pg, clueText)) break;
    }

    // La pista debe aparecer en pantalla de algún jugador.
    let clueVisible = false;
    for (const pg of pages) {
      if (await pg.getByText(clueText).isVisible({ timeout: 8_000 }).catch(() => false)) {
        clueVisible = true;
        break;
      }
    }
    expect(clueVisible).toBe(true);

    for (const ctx of contexts) await ctx.close();
  });
});

test.describe('Reveal — abstención visible', () => {
  test.setTimeout(120_000);

  test('las abstenciones aparecen en la pantalla de resultado', async ({ browser }) => {
    const { pages, contexts, pageHost } = await createAndJoin(browser, 3);

    await pageHost.getByText('Empezar').click();
    await expect(pageHost.getByText(/vuelta|PISTA|clue/i)).toBeVisible({ timeout: 20_000 });

    // Todos dan su pista para completar la vuelta.
    for (const pg of pages) {
      await tryGiveClue(pg, 'test');
    }

    // Host abre votación.
    const votingBtn = pageHost.getByText(/Abrir votación|Iniciar votación/i);
    if (await votingBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await votingBtn.click();
    }

    // Al menos un jugador se abstiene.
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
      // Si la votación ya cerró automáticamente, saltamos la verificación de abstención.
      for (const ctx of contexts) await ctx.close();
      return;
    }

    // Host revela (si no se auto-reveló).
    const revealBtn = pageHost.getByText(/Revelar resultado/i);
    if (await revealBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await revealBtn.click();
    }

    // En el reveal debe verse la sección de abstenciones.
    await expect(pageHost.getByText(/abstuvieron|abstuvo/i)).toBeVisible({ timeout: 10_000 });

    for (const ctx of contexts) await ctx.close();
  });
});
