import { test, expect } from './fixtures';

test('Aspetto: carattere, sfondo e maiuscolo si applicano e restano dopo aver ricaricato', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Aspetto' }).click();
  const panel = page.getByRole('dialog', { name: 'Aspetto e voce' });
  await panel.getByRole('button', { name: 'Atkinson' }).click();
  await panel.getByRole('button', { name: 'Scuro' }).click();
  await panel.getByLabel('TUTTO IN STAMPATELLO MAIUSCOLO').check();
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-font', 'atkinson');
  await expect(html).toHaveAttribute('data-theme', 'scuro');
  await expect(html).toHaveAttribute('data-uppercase', 'true');
  await panel.getByRole('button', { name: 'Chiudi' }).click();
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'scuro');
  await expect(html).toHaveAttribute('data-font', 'atkinson');
});
