import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('should navigate to login page', async ({ page }) => {
    await page.goto('/auth/login');
    // Verify login form is present
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
    await expect(page.getByLabel(/e-mail/i)).toBeVisible();
    await expect(page.getByLabel(/senha/i)).toBeVisible();
  });

  test('should show validation errors on empty submit', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: /entrar/i }).click();
    
    // Expect some validation error text to appear (based on zod schema in the app)
    // Adjust text based on actual implementation, often "E-mail inválido" or "Digite sua senha"
    await expect(page.getByText(/E-mail inválido/i)).toBeVisible(); 
  });
});
