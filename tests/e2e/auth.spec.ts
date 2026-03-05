import { expect, test } from "@playwright/test"

test("@smoke login page renders form controls", async ({ page }) => {
  await page.goto("/login")
  await expect(page).toHaveTitle(/WriteTeam/i)
  await expect(page.locator('input[name="email"]')).toBeVisible()
  await expect(page.locator('input[name="password"]')).toBeVisible()
})
