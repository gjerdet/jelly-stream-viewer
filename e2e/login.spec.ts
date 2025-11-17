import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.getByRole('heading', { name: /logg inn/i })).toBeVisible();
    await expect(page.getByPlaceholder(/e-post/i)).toBeVisible();
    await expect(page.getByPlaceholder(/passord/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /logg inn/i })).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByPlaceholder(/e-post/i).fill('invalid@example.com');
    await page.getByPlaceholder(/passord/i).fill('wrongpassword');
    await page.getByRole('button', { name: /logg inn/i }).click();
    
    // Wait for error message
    await expect(page.getByText(/feil/i)).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByRole('link', { name: /registrer/i }).click();
    
    await expect(page.getByRole('heading', { name: /registrer/i })).toBeVisible();
  });
});
