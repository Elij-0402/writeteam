import { expect, test } from "@playwright/test"

test("@smoke signup page renders form controls", async ({ page }) => {
  await page.goto("/signup")
  await expect(page.locator('input[name="email"]')).toBeVisible()
  await expect(page.locator('input[name="password"]')).toBeVisible()
})
