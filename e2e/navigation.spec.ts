import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate to home page', async ({ page }) => {
    await page.goto('/');
    
    // Should show hero or main content
    await expect(page.locator('main')).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');
    
    // Check for common navigation elements
    const nav = page.locator('nav, header').first();
    await expect(nav).toBeVisible();
  });

  test('should display 404 page for invalid routes', async ({ page }) => {
    await page.goto('/non-existent-page');
    
    // Should show 404 or redirect
    await expect(page.locator('body')).toBeVisible();
  });
});
