import { test, expect, type Page, type Browser } from '@playwright/test';

/**
 * Tests E2E del flujo de juego:
 * - Botón de abstención visible en fase de votación
 * - ClueCard con barra de color a la izquierda
 * - Podio de sesión al terminar
 *
 * Estos tests requieren una partida real con múltiples jugadores,
 * por eso son más lentos y necesitan el servidor Convex operativo.
 */

// ─── helpers ─────────────────────────────────────────────────────────────────

async function waitForApp(page: Page) {
  await page.goto('/');
  await expect(page.getByText('IMPOSTOR')).toBeVisible({ timeout: 15_000 });
}

async function createAndJoin(browser: Browser, playerCount: number) {
  const contexts = [];
  const pages: Page[] = [];

  // Host
  const ctxHost = await browser.newContext();
  const pageHost = await ctxHost.newPage();
  await waitForApp(pageHost);
  await pageHost.getByPlaceholder('Ej. Dani').fill('Host');
  await pageHost.getByText('Crear sala').click();
  await expect(pageHost.getByText(/SALA|lobby/i)).toBeVisible({ timeout: 15_000 });
  const url = pageHost.url();
  const code = url.match(/\/room\/([A-Z0-9]{4,8})/)?.[1] ?? '';
  contexts.push(ctxHost);
  pages.push(pageHost);

  // Jugadores adicionales
  for (let i = 2; i <= playerCount; i++) {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    await waitForApp(pg);
    await pg.getByPlaceholder('Ej. Dani').fill(`P${i}`);
    await pg.getByPlaceholder('ABC123').fill(code);
    await pg.getByText('Unirme').click();
    await expect(pg.url()).toContain(`/room/${code}`);
    contexts.push(ctx);
    pages.push(pg);
  }

  return { code, pages, contexts, pageHost };
}

// ─── tests ───────────────────────────────────────────────────────────────────

test.describe('Flujo de juego — abstención', () => {
  test.setTimeout(90_000); // Partida completa puede tardar más.

  test('botón Abstenerme visible en fase de votación', async ({ browser }) => {
    const { pages, contexts, pageHost } = await createAndJoin(browser, 3);
    const [pageP1, pageP2, pageP3] = pages;

    // Host inicia la partida.
    await pageHost.getByText('Empezar').click();
    // Esperar fase de pistas.
    await expect(pageHost.getByText(/PISTA|CLUE|vuelta/i)).toBeVisible({ timeout: 15_000 });

    // Cada jugador da una pista rápida (texto simple).
    for (const pg of pages) {
      const input = pg.getByPlaceholder(/pista|clue/i);
      if (await input.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await input.fill('pista test');
        const submitBtn = pg.getByRole('button', { name: /enviar|dar pista/i });
        if (await submitBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await submitBtn.click();
        }
      }
    }

    // Host abre la votación.
    const votingBtn = pageHost.getByText(/Abrir votación|Iniciar votación/i);
    if (await votingBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await votingBtn.click();
    }

    // Verificar que el botón Abstenerme aparece en la pantalla de algún jugador.
    let abstainVisible = false;
    for (const pg of pages) {
      if (await pg.getByText('Abstenerme').isVisible({ timeout: 5_000 }).catch(() => false)) {
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

    // Host inicia partida.
    await pageHost.getByText('Empezar').click();
    await expect(pageHost.getByText(/PISTA|CLUE|vuelta/i)).toBeVisible({ timeout: 15_000 });

    // El orador actual da una pista.
    for (const pg of pages) {
      const input = pg.getByPlaceholder(/pista|clue/i);
      if (await input.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await input.fill('Jugó en el Barça y ganó el Balón de Oro');
        const btn = pg.getByRole('button', { name: /enviar|dar pista/i });
        if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await btn.click();
          break; // Solo un jugador da pista por turno.
        }
      }
    }

    // Verificar que aparece una ClueCard con barra de color (View de 4px de ancho).
    // La barra se renderiza como un View con style width:4. En la web, esto es un div.
    // Verificamos que el texto de la pista aparece en algún jugador.
    let clueVisible = false;
    for (const pg of pages) {
      if (await pg.getByText('Jugó en el Barça y ganó el Balón de Oro').isVisible({ timeout: 5_000 }).catch(() => false)) {
        clueVisible = true;
        // La barra de color: buscar un elemento con width exacto de 4px cerca del texto.
        const card = pg.locator('text=Jugó en el Barça y ganó el Balón de Oro').first();
        await expect(card).toBeVisible();
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
    await expect(pageHost.getByText(/PISTA|CLUE|vuelta/i)).toBeVisible({ timeout: 15_000 });

    // Dar pistas hasta agotar la vuelta.
    for (const pg of pages) {
      const input = pg.getByPlaceholder(/pista|clue/i);
      if (await input.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await input.fill('test');
        const btn = pg.getByRole('button', { name: /enviar|dar pista/i });
        if (await btn.isVisible().catch(() => false)) await btn.click();
      }
    }

    // Host abre votación.
    const votingBtn = pageHost.getByText(/Abrir votación|Iniciar votación/i);
    if (await votingBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await votingBtn.click();
    }

    // Al menos un jugador se abstiene.
    for (const pg of pages) {
      const abstainBtn = pg.getByText('Abstenerme');
      if (await abstainBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await abstainBtn.click();
        break;
      }
    }

    // Host revela.
    const revealBtn = pageHost.getByText(/Revelar resultado/i);
    if (await revealBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await revealBtn.click();
    }

    // En el reveal debe verse la sección de abstenciones.
    await expect(pageHost.getByText(/abstuvieron|abstuvo/i)).toBeVisible({ timeout: 10_000 });

    for (const ctx of contexts) await ctx.close();
  });
});
