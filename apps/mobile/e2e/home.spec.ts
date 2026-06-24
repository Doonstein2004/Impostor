import { test, expect } from '@playwright/test';

/**
 * Smoke tests de la pantalla de inicio.
 * Verifican que la app carga, renderiza los elementos clave y responde a la
 * interacción básica antes de entrar a una sala.
 */
test.describe('Home screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Esperar a que la app esté lista (el título principal debe verse).
    await expect(page.getByText('IMPOSTOR')).toBeVisible({ timeout: 15_000 });
  });

  test('muestra el título y los controles principales', async ({ page }) => {
    await expect(page.getByText('IMPOSTOR')).toBeVisible();
    await expect(page.getByPlaceholder('Ej. Dani')).toBeVisible();
    await expect(page.getByText('Crear sala')).toBeVisible();
    await expect(page.getByText('Unirme')).toBeVisible();
    await expect(page.getByPlaceholder('ABC123')).toBeVisible();
  });

  test('valida nombre vacío antes de crear sala', async ({ page }) => {
    // Sin nombre, hacer clic en Crear sala debe mostrar error inline.
    await page.getByText('Crear sala').click();
    await expect(page.getByText(/nombre/i)).toBeVisible();
  });

  test('valida nombre vacío antes de unirse', async ({ page }) => {
    // Sin nombre, hacer clic en Unirme debe mostrar error inline.
    await page.getByText('Unirme').click();
    await expect(page.getByText(/nombre/i)).toBeVisible();
  });

  test('error con código inexistente', async ({ page }) => {
    await page.getByPlaceholder('Ej. Dani').fill('TestPlayer');
    await page.getByPlaceholder('ABC123').fill('ZZZZZZ');
    await page.getByText('Unirme').click();
    // Debe aparecer un mensaje de error (código no encontrado).
    await expect(page.getByText(/no existe|no encontr|code/i)).toBeVisible({ timeout: 10_000 });
  });

  test('muestra enlace de estadísticas y ranking', async ({ page }) => {
    await expect(page.getByText('Mis estadísticas')).toBeVisible();
    await expect(page.getByText('Ranking')).toBeVisible();
  });
});
