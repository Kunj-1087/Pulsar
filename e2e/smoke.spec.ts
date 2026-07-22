import { test, expect } from '@playwright/test';

test('app loads and displays the landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Quark')).toBeVisible({ timeout: 15000 });
});
