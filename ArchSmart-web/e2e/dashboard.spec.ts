import { test, expect } from '@playwright/test';

test.describe('Dashboard Navigation', () => {
  test('should redirect to login if not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });
});
