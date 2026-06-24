import { test, expect, type Page } from '@playwright/test';

/**
 * Tests E2E para la creación y gestión de salas:
 * - Flujo básico de crear + unirse
 * - Contraseña: input aparece lazy cuando falla; join exitoso con contraseña
 * - Límite de jugadores: el jugador de más es rechazado
 */

// ─── helpers ─────────────────────────────────────────────────────────────────

async function fillNameAndCreate(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await expect(page.getByText('IMPOSTOR')).toBeVisible({ timeout: 15_000 });
  await page.getByPlaceholder('Ej. Dani').fill(name);
  await page.getByText('Crear sala').click();
  // Esperar a que llegue al lobby (aparece el código de sala).
  await expect(page.getByText(/SALA|Lobby|lobby/i)).toBeVisible({ timeout: 15_000 });
  // Extraer el código de la URL (/room/XXXX).
  const url = page.url();
  const match = url.match(/\/room\/([A-Z0-9]{4,8})/);
  return match?.[1] ?? '';
}

async function joinRoom(page: Page, name: string, code: string, password?: string) {
  await page.goto('/');
  await expect(page.getByText('IMPOSTOR')).toBeVisible({ timeout: 15_000 });
  await page.getByPlaceholder('Ej. Dani').fill(name);
  await page.getByPlaceholder('ABC123').fill(code);
  await page.getByText('Unirme').click();
}

// ─── tests ───────────────────────────────────────────────────────────────────

test.describe('Crear e ingresar a sala', () => {
  test('crear sala lleva al lobby con el código en la URL', async ({ page }) => {
    const code = await fillNameAndCreate(page, 'TestHost');
    expect(code).toHaveLength(6);
    expect(page.url()).toContain(`/room/${code}`);
  });

  test('unirse a sala existente funciona', async ({ browser }) => {
    // Contexto A — host crea la sala.
    const ctxHost = await browser.newContext();
    const pageHost = await ctxHost.newPage();
    const code = await fillNameAndCreate(pageHost, 'HostE2E');

    // Contexto B — jugador se une.
    const ctxPlayer = await browser.newContext();
    const pagePlayer = await ctxPlayer.newPage();
    await pagePlayer.goto('/');
    await expect(pagePlayer.getByText('IMPOSTOR')).toBeVisible({ timeout: 15_000 });
    await pagePlayer.getByPlaceholder('Ej. Dani').fill('PlayerE2E');
    await pagePlayer.getByPlaceholder('ABC123').fill(code);
    await pagePlayer.getByText('Unirme').click();

    await expect(pagePlayer.url()).toContain(`/room/${code}`);

    // El host debe ver al jugador en la lista del lobby.
    await expect(pageHost.getByText('PlayerE2E')).toBeVisible({ timeout: 10_000 });

    await ctxHost.close();
    await ctxPlayer.close();
  });
});

test.describe('Sala con contraseña', () => {
  test('input de contraseña aparece solo cuando la sala la requiere', async ({ browser }) => {
    // Host crea sala con contraseña (vía Lobby — simplificamos: creamos sin contraseña
    // y verificamos el flujo de error. Para una sala con contraseña real hay que pasar
    // por el lobby y configurarla, lo cual es más complejo).

    // Flujo: sala inexistente → error normal (sin campo de contraseña).
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.getByText('IMPOSTOR')).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder('Ej. Dani').fill('TestPlayer');
    await page.getByPlaceholder('ABC123').fill('ZZZZZZ');
    await page.getByText('Unirme').click();

    // El campo de contraseña NO debe aparecer (el error es de sala no encontrada, no de contraseña).
    await expect(page.getByPlaceholder('Ingresá la contraseña')).not.toBeVisible();
    await ctx.close();
  });

  test('flujo completo: crear sala con contraseña → join sin pw falla → join con pw ok', async ({ browser }) => {
    // Host crea sala.
    const ctxHost = await browser.newContext();
    const pageHost = await ctxHost.newPage();
    const code = await fillNameAndCreate(pageHost, 'HostPw');

    // Host agrega contraseña desde el Lobby.
    const addPwButton = pageHost.getByText('Agregar contraseña');
    await expect(addPwButton).toBeVisible({ timeout: 8_000 });
    await addPwButton.click();

    // Aparece input de contraseña — escribir y guardar.
    const pwInput = pageHost.getByPlaceholder(/contraseña/i).first();
    await expect(pwInput).toBeVisible({ timeout: 5_000 });
    await pwInput.fill('clave123');
    await pageHost.getByText('Guardar').click();

    // Esperar confirmación (🔒 aparece).
    await expect(pageHost.getByText('🔒')).toBeVisible({ timeout: 5_000 });

    // Jugador intenta unirse sin contraseña.
    const ctxPlayer = await browser.newContext();
    const pagePlayer = await ctxPlayer.newPage();
    await pagePlayer.goto('/');
    await expect(pagePlayer.getByText('IMPOSTOR')).toBeVisible({ timeout: 15_000 });
    await pagePlayer.getByPlaceholder('Ej. Dani').fill('PlayerPw');
    await pagePlayer.getByPlaceholder('ABC123').fill(code);
    await pagePlayer.getByText('Unirme').click();

    // El campo de contraseña debe aparecer después del error.
    await expect(pagePlayer.getByPlaceholder('Ingresá la contraseña')).toBeVisible({ timeout: 8_000 });

    // Ahora ingresa la contraseña correcta y vuelve a intentar.
    await pagePlayer.getByPlaceholder('Ingresá la contraseña').fill('clave123');
    await pagePlayer.getByText('Unirme').click();

    // Debe llegar al lobby.
    await expect(pagePlayer.url()).toContain(`/room/${code}`);

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

    // Host configura maxPlayers = 2 (él + 1 jugador).
    // Abrir tab "Partida" en la config.
    await pageHost.getByText('Partida').click();
    // Tocar el chip "2" de máximo de jugadores.
    const chip2 = pageHost.getByRole('button', { name: '2' });
    if (await chip2.isVisible()) {
      await chip2.click();
    }

    // Jugador 2 entra — debe funcionar (hay lugar).
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto('/');
    await expect(page2.getByText('IMPOSTOR')).toBeVisible({ timeout: 15_000 });
    await page2.getByPlaceholder('Ej. Dani').fill('Player2');
    await page2.getByPlaceholder('ABC123').fill(code);
    await page2.getByText('Unirme').click();
    await expect(page2.url()).toContain(`/room/${code}`);

    // Jugador 3 intenta entrar — debe ser rechazado.
    const ctx3 = await browser.newContext();
    const page3 = await ctx3.newPage();
    await page3.goto('/');
    await expect(page3.getByText('IMPOSTOR')).toBeVisible({ timeout: 15_000 });
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
