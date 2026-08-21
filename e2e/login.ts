import { expect, type Page } from "@playwright/test"
import { E2E_USERS } from "./test-env"

type E2EUser = typeof E2E_USERS[keyof typeof E2E_USERS]

export async function loginE2E(
    page: Page,
    user: E2EUser,
    expectedUrl: RegExp = /\/dashboard(?:\/investor)?$/
): Promise<void> {
    await page.goto("/login")
    await page.getByLabel("Username / Email").fill(user.username)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Login" }).click()

    await expect(page.getByText("Login berhasil")).toBeVisible()
    await expect(page).toHaveURL(expectedUrl, { timeout: 15_000 })
}
