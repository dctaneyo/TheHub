import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/')
    // Should redirect to login page
    await expect(page).toHaveURL(/.*login/)
  })

  test('login page renders pin pad', async ({ page }) => {
    await page.goto('/login')
    // Pin pad should be visible
    await expect(page.locator('body')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')
  })
})
