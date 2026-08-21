import { expect, test, type Page } from "@playwright/test"
import { E2E_USERS } from "../test-env"
import {
    cleanupE2EUsers,
    countE2EAccessFixtures,
    countE2EUserByUsername,
    getE2EAccessFixtures,
    getE2EAccessMutationState,
    seedE2EUsers,
} from "../seed"

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

test("investor reads only their own tenant and cannot mutate", async ({ page }) => {
    const fixtures = await getE2EAccessFixtures()
    await login(page, E2E_USERS.investor)

    const investors = await (await page.request.get("/api/investors")).json()
    expect(investors.map((item: { id: string }) => item.id)).toEqual([fixtures.ownInvestorId])

    const units = await (await page.request.get("/api/units?investorStatus=inactive")).json()
    expect(units.map((item: { id: string }) => item.id)).toEqual([fixtures.ownUnitId])

    const transactions = await (await page.request.get("/api/transactions?investorStatus=inactive")).json()
    expect(transactions.map((item: { id: string }) => item.id)).toEqual([fixtures.ownTransactionId])

    const foreignTransaction = await page.request.get(`/api/transactions/${fixtures.otherTransactionId}`)
    const missingTransaction = await page.request.get("/api/transactions/e2e-rbac-missing-transaction")
    expect(foreignTransaction.status()).toBe(404)
    expect(missingTransaction.status()).toBe(404)
    expect(await foreignTransaction.json()).toEqual(await missingTransaction.json())
    expect((await page.request.get(`/api/reports/transaction/${fixtures.otherTransactionId}`)).status()).toBe(403)
    expect((await page.request.get(`/api/reports/investor/${fixtures.otherInvestorId}`)).status()).toBe(403)
    expect((await page.request.get(`/api/reports/investor/${fixtures.otherInvestorId}/csv`)).status()).toBe(403)

    const forbiddenCode = "E2E-RBAC-FORBIDDEN-UNIT"
    const forbiddenWrite = await page.request.post("/api/units", {
        data: { investorId: fixtures.ownInvestorId, name: "Must Not Exist", code: forbiddenCode },
    })
    expect(forbiddenWrite.status()).toBe(403)
    const before = await getE2EAccessMutationState(fixtures.ownTransactionId)
    const malformed = { headers: { "content-type": "application/json" }, data: "{malformed-json" }
    expect((await page.request.post(`/api/transactions/${fixtures.ownTransactionId}/sell`, malformed)).status()).toBe(403)
    expect((await page.request.post(`/api/transactions/${fixtures.ownTransactionId}/payments`, malformed)).status()).toBe(403)
    expect(await getE2EAccessMutationState(fixtures.ownTransactionId)).toEqual(before)
    expect(await countE2EAccessFixtures({ unitCode: forbiddenCode })).toBe(0)
})

test("viewer can read admin data but representative mutations are denied", async ({ page }) => {
    const fixtures = await getE2EAccessFixtures()
    await login(page, E2E_USERS.viewer)

    expect((await page.request.get("/api/activity-logs")).status()).toBe(200)
    expect((await page.request.get("/api/reports/all-investors")).status()).toBe(200)

    const before = await getE2EAccessMutationState(fixtures.ownTransactionId)
    const malformed = { headers: { "content-type": "application/json" }, data: "{malformed-json" }
    const attempts = [
        page.request.post("/api/transactions", malformed),
        page.request.post(`/api/transactions/${fixtures.ownTransactionId}/sell`, malformed),
        page.request.post(`/api/transactions/${fixtures.ownTransactionId}/payments`, malformed),
        page.request.post("/api/investors", malformed),
        page.request.post("/api/units", malformed),
    ]
    for (const response of await Promise.all(attempts)) expect(response.status()).toBe(403)
    expect(await getE2EAccessMutationState(fixtures.ownTransactionId)).toEqual(before)
})

test("unauthenticated transactions API returns 401", async ({ request }) => {
    const response = await request.get("/api/transactions")
    expect(response.status()).toBe(401)
})
