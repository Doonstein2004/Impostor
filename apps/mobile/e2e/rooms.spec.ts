import { test, expect, type Page } from '@playwright/test';

/**
 * Tests E2E para la creación y gestión de salas.
 *
 * Prerequisito: Expo dev server corriendo en :8081, Convex operativo.
 */

// ─── helpers ─────────────────────────────────────────────────────────────────

async function waitForHome(page: Page) {
  await page.goto('/');
  await expect(page.getByText('IMPOSTOR')).toBeVisible({ timeout: 50_000 });
}

/**
 * Crea una sala y espera hasta que la URL cambie a /room/XXXX.
 * Devuelve el código de 6 chars.
 * IMPORTANTE: usa waitForURL en vez de esperar texto del lobby porque la banner
 * "SALA ACTIVA" del home matchea /SALA/ antes de que se complete la navegación.
 */
async function fillNameAndCreate(page: Page, name: string): Promise<string> {
  await waitForHome(page);
  await page.getByPlaceholder('Ej. Dani').fill(name);
  await page.getByText('Crear sala').click();
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 20_000 });
  const match = page.url().match(/\/room\/([A-Z0-9]{4,8})/);
  return match?.[1] ?? '';
}

// ─── tests ───────────────────────────────────────────────────────────────────

test.describe('Crear e ingresar a sala', () => {
  test('crear sala lleva al lobby con el código en la URL', async ({ page }) => {
    const code = await fillNameAndCreate(page, 'TestHost');
    expect(code).toHaveLength(6);
    await expect(page).toHaveURL(`/room/${code}`);
  });

  test('unirse a sala existente funciona', async ({ browser }) => {
    // Contexto A — host crea la sala.
    const ctxHost = await browser.newContext();
    const pageHost = await ctxHost.newPage();
    const code = await fillNameAndCreate(pageHost, 'HostE2E');

    // Contexto B — jugador se une.
    const ctxPlayer = await browser.newContext();
    const pagePlayer = await ctxPlayer.newPage();
    await waitForHome(pagePlayer);
    await pagePlayer.getByPlaceholder('Ej. Dani').fill('PlayerE2E');
    await pagePlayer.getByPlaceholder('ABC123').fill(code);
    await pagePlayer.getByText('Unirme').click();

    // Esperar navegación al lobby del jugador.
    await expect(pagePlayer).toHaveURL(/\/room\//, { timeout: 15_000 });

    // El host debe ver al jugador en la lista del lobby.
    await expect(pageHost.getByText('PlayerE2E')).toBeVisible({ timeout: 10_000 });

    await ctxHost.close();
    await ctxPlayer.close();
  });
});

test.describe('Sala con contraseña', () => {
  test('input de contraseña NO aparece para sala inexistente', async ({ page }) => {
    await waitForHome(page);
    await page.getByPlaceholder('Ej. Dani').fill('TestPlayer');
    await page.getByPlaceholder('ABC123').fill('ZZZZZZ');
    await page.getByText('Unirme').click();

    // El campo de contraseña NO debe aparecer (el error es de sala no encontrada).
    await expect(page.getByPlaceholder('Ingresá la contraseña')).not.toBeVisible();
  });

  test('flujo completo: crear sala con contraseña → join sin pw falla → join con pw ok', async ({ browser }) => {
    // Host crea sala.
    const ctxHost = await browser.newContext();
    const pageHost = await ctxHost.newPage();
    const code = await fillNameAndCreate(pageHost, 'HostPw');

    // Host agrega contraseña desde el Lobby.
    // El botón en la UI dice "+ Agregar" (sin contraseña) o "Cambiar" (con contraseña).
    const addPwButton = pageHost.getByText('+ Agregar');
    await expect(addPwButton).toBeVisible({ timeout: 8_000 });
    await addPwButton.click();

    // Aparece input de contraseña — escribir y guardar.
    const pwInput = pageHost.getByPlaceholder(/contraseña/i).first();
    await expect(pwInput).toBeVisible({ timeout: 5_000 });
    await pwInput.fill('clave123');
    await pageHost.getByText('Guardar').click();

    // Esperar confirmación (texto cambia a "Con contraseña" o "Cambiar").
    await expect(pageHost.getByText(/Con contraseña|Cambiar/i)).toBeVisible({ timeout: 5_000 });

    // Jugador intenta unirse sin contraseña.
    const ctxPlayer = await browser.newContext();
    const pagePlayer = await ctxPlayer.newPage();
    await waitForHome(pagePlayer);
    await pagePlayer.getByPlaceholder('Ej. Dani').fill('PlayerPw');
    await pagePlayer.getByPlaceholder('ABC123').fill(code);
    await pagePlayer.getByText('Unirme').click();

    // El campo de contraseña debe aparecer después del error.
    await expect(pagePlayer.getByPlaceholder('Ingresá la contraseña')).toBeVisible({ timeout: 8_000 });

    // Ahora ingresa la contraseña correcta y vuelve a intentar.
    await pagePlayer.getByPlaceholder('Ingresá la contraseña').fill('clave123');
    await pagePlayer.getByText('Unirme').click();

    // Debe llegar al lobby.
    await expect(pagePlayer).toHaveURL(/\/room\//, { timeout: 15_000 });

    await ctxHost.close();
    await ctxPlayer.close();
  });
});

test.describe('Límite de jugadores', () => {
  test('el jugador de más es rechazado con mensaje de sala llena', async ({ browser }) => {
    // Host crea sala.
    const ctxHost = await browser.newContext();
    const pageHost = await ctxHost.newPage();
    const code = await fillNameAndCreate(pageHost, 'HostLimit');

    // Host configura maxPlayers = 2 en la tab "🃏 Partida".
    // El texto exacto del tab es "🃏 Partida" (con emoji).
    await pageHost.getByText('🃏 Partida').click();
    // Tocar el chip "2" de máximo de jugadores.
    const chip2 = pageHost.getByRole('button', { name: '2' });
    if (await chip2.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await chip2.click();
    }

    // Jugador 2 entra — debe funcionar (hay lugar).
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await waitForHome(page2);
    await page2.getByPlaceholder('Ej. Dani').fill('Player2');
    await page2.getByPlaceholder('ABC123').fill(code);
    await page2.getByText('Unirme').click();
    await expect(page2).toHaveURL(/\/room\//, { timeout: 15_000 });

    // Jugador 3 intenta entrar — debe ser rechazado.
    const ctx3 = await browser.newContext();
    const page3 = await ctx3.newPage();
    await waitForHome(page3);
    await page3.getByPlaceholder('Ej. Dani').fill('Player3');
    await page3.getByPlaceholder('ABC123').fill(code);
    await page3.getByText('Unirme').click();

    // Error: sala llena.
    await expect(page3.getByText(/llena|lleno|máx|max/i)).toBeVisible({ timeout: 8_000 });

    await ctxHost.close();
    await ctx2.close();
    await ctx3.close();
  });
});
