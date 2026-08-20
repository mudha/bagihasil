import { expect, test, type Page } from "@playwright/test"
import { E2E_USERS } from "../test-env"
import { cleanupE2EUsers, countE2EUserByUsername, seedE2EUsers } from "../seed"

async function login(page: Page, user: typeof E2E_USERS[keyof typeof E2E_USERS]) {
    await page.goto("/login")
    await page.getByLabel("Username / Email").fill(user.username)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page.getByText("Login berhasil")).toBeVisible()
}

test.beforeAll(async () => {
    await seedE2EUsers()
})

test.afterAll(async () => {
    await cleanupE2EUsers()
})

test("unauthenticated dashboard access redirects to login", async ({ page }) => {
    await page.goto("/dashboard/transactions")
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText("Selamat datang", { exact: true })).toBeVisible()
})

test("invalid credentials stay on login", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Username / Email").fill(E2E_USERS.admin.username)
    await page.getByLabel("Password").fill("WrongPassword!2026")
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText("Username/email atau password salah")).toBeVisible()
})

test("admin can access normal dashboard and is redirected away from investor portal", async ({ page }) => {
    await login(page, E2E_USERS.admin)
    const sessionResponse = await page.request.get("/api/auth/session")
    expect(sessionResponse.ok()).toBe(true)
    expect(await sessionResponse.json()).toMatchObject({ user: { role: "ADMIN" } })
    expect((await page.request.get("/api/users")).status()).toBe(200)
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.goto("/dashboard/investor")
    await expect(page).toHaveURL(/\/dashboard$/)
})

test("viewer can access read-only dashboard but cannot see admin user management", async ({ page }) => {
    await login(page, E2E_USERS.viewer)
    await expect(page).toHaveURL(/\/dashboard$/)
    const sessionResponse = await page.request.get("/api/auth/session")
    expect(sessionResponse.ok()).toBe(true)
    expect(await sessionResponse.json()).toMatchObject({ user: { role: "VIEWER" } })
    await expect(page.getByRole("link", { name: /Pengguna/i })).toHaveCount(0)
    const malformedWrite = await page.request.post("/api/users", {
        headers: { "content-type": "application/json" },
        data: "{malformed-json",
    })
    expect(malformedWrite.status()).toBe(403)

    const forbiddenUsername = "e2e_viewer_forbidden_write"
    const validForbiddenWrite = await page.request.post("/api/users", {
        data: {
            name: "Must Not Exist",
            username: forbiddenUsername,
            password: "MustNotExist!2026",
            role: "VIEWER",
        },
    })
    expect(validForbiddenWrite.status()).toBe(403)
    expect(await countE2EUserByUsername(forbiddenUsername)).toBe(0)
})

test("investor is confined to investor portal", async ({ page }) => {
    await login(page, E2E_USERS.investor)
    await expect(page).toHaveURL(/\/dashboard\/investor$/)
    const sessionResponse = await page.request.get("/api/auth/session")
    expect(sessionResponse.ok()).toBe(true)
    expect(await sessionResponse.json()).toMatchObject({ user: { role: "INVESTOR" } })
    await page.goto("/dashboard/transactions")
    await expect(page).toHaveURL(/\/dashboard\/investor$/)
})

test("unauthenticated transactions API returns 401", async ({ request }) => {
    const response = await request.get("/api/transactions")
    expect(response.status()).toBe(401)
})
