import { expect, test } from "@playwright/test"
import { E2E_USERS } from "../test-env"
import {
    cleanupE2ETransactionFixtures,
    EDGE_FIXTURES,
    getE2ETransactionByCode,
    getE2ETransactionSideEffectState,
    seedE2EFinancialEdgeFixtures,
} from "../transaction-fixtures"
import { cleanupE2EUsers, seedE2EUsers } from "../seed"

test.beforeAll(async () => {
    await seedE2EUsers()
    await seedE2EFinancialEdgeFixtures()
})
test.afterAll(async () => {
    await cleanupE2ETransactionFixtures()
    await cleanupE2EUsers()
})

test("admin finalizes a loss without creating positive profit shares", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Username / Email").fill(E2E_USERS.admin.username)
    await page.getByLabel("Password").fill(E2E_USERS.admin.password)
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    const seeded = await getE2ETransactionByCode(EDGE_FIXTURES.loss.code)
    expect(seeded).not.toBeNull()

    const response = await page.request.put(`/api/transactions/${seeded!.id}`, {
        data: {
            status: "COMPLETED",
            sellDate: "2026-08-21",
            sellPrice: EDGE_FIXTURES.loss.sellPrice,
            investorSharePercentage: EDGE_FIXTURES.loss.investorSharePercentage,
            managerSharePercentage: EDGE_FIXTURES.loss.managerSharePercentage,
        },
    })
    expect(response.ok()).toBe(true)

    const stored = await getE2ETransactionByCode(EDGE_FIXTURES.loss.code)
    expect(stored).toMatchObject({
        status: "COMPLETED",
        sellPrice: 90,
        profitStatus: "LOSS",
        profitSharing: {
            netMargin: -10,
            investorProfitAmount: 0,
            managerProfitAmount: 0,
        },
    })
})

test("admin finalizes an exact break-even transaction without profit or loss", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Username / Email").fill(E2E_USERS.admin.username)
    await page.getByLabel("Password").fill(E2E_USERS.admin.password)
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    const seeded = await getE2ETransactionByCode(EDGE_FIXTURES.breakEven.code)
    expect(seeded).not.toBeNull()
    const response = await page.request.put(`/api/transactions/${seeded!.id}`, {
        data: {
            status: "COMPLETED",
            sellDate: "2026-08-21",
            sellPrice: EDGE_FIXTURES.breakEven.sellPrice,
            investorSharePercentage: EDGE_FIXTURES.breakEven.investorSharePercentage,
            managerSharePercentage: EDGE_FIXTURES.breakEven.managerSharePercentage,
        },
    })
    expect(response.ok()).toBe(true)

    const stored = await getE2ETransactionByCode(EDGE_FIXTURES.breakEven.code)
    expect(stored).toMatchObject({
        status: "COMPLETED",
        sellPrice: 100,
        profitStatus: "BREAK_EVEN",
        profitSharing: {
            netMargin: 0,
            investorProfitAmount: 0,
            managerProfitAmount: 0,
        },
    })
})

test("admin persists rounded rupiah shares and exact remainder", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Username / Email").fill(E2E_USERS.admin.username)
    await page.getByLabel("Password").fill(E2E_USERS.admin.password)
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    const seeded = await getE2ETransactionByCode(EDGE_FIXTURES.rounding.code)
    expect(seeded).not.toBeNull()
    const response = await page.request.put(`/api/transactions/${seeded!.id}`, {
        data: {
            status: "COMPLETED",
            sellDate: "2026-08-21",
            sellPrice: EDGE_FIXTURES.rounding.sellPrice,
            investorSharePercentage: EDGE_FIXTURES.rounding.investorSharePercentage,
            managerSharePercentage: EDGE_FIXTURES.rounding.managerSharePercentage,
        },
    })
    expect(response.ok()).toBe(true)

    const stored = await getE2ETransactionByCode(EDGE_FIXTURES.rounding.code)
    expect(stored).toMatchObject({
        status: "COMPLETED",
        profitStatus: "PROFIT",
        profitSharing: {
            netMargin: 1,
            investorProfitAmount: 0,
            managerProfitAmount: 1,
        },
    })
    expect(Number.isInteger(stored!.profitSharing!.investorProfitAmount)).toBe(true)
    expect(Number.isInteger(stored!.profitSharing!.managerProfitAmount)).toBe(true)
    expect(stored!.profitSharing!.investorProfitAmount + stored!.profitSharing!.managerProfitAmount)
        .toBe(stored!.profitSharing!.netMargin)
})

test("duplicate finalization preserves the financial snapshot and side-effect counts", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Username / Email").fill(E2E_USERS.admin.username)
    await page.getByLabel("Password").fill(E2E_USERS.admin.password)
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    const seeded = await getE2ETransactionByCode(EDGE_FIXTURES.rounding.code)
    expect(seeded).not.toBeNull()
    const first = await page.request.put(`/api/transactions/${seeded!.id}`, {
        data: {
            status: "COMPLETED",
            sellDate: "2026-08-21",
            sellPrice: EDGE_FIXTURES.rounding.sellPrice,
            investorSharePercentage: EDGE_FIXTURES.rounding.investorSharePercentage,
            managerSharePercentage: EDGE_FIXTURES.rounding.managerSharePercentage,
        },
    })
    expect(first.ok()).toBe(true)
    const afterFirst = await getE2ETransactionByCode(EDGE_FIXTURES.rounding.code)
    const effectsAfterFirst = await getE2ETransactionSideEffectState(EDGE_FIXTURES.rounding.code)

    const second = await page.request.put(`/api/transactions/${seeded!.id}`, {
        data: {
            status: "COMPLETED",
            sellDate: "2026-08-21",
            sellPrice: EDGE_FIXTURES.rounding.sellPrice,
            investorSharePercentage: EDGE_FIXTURES.rounding.investorSharePercentage,
            managerSharePercentage: EDGE_FIXTURES.rounding.managerSharePercentage,
        },
    })
    expect(second.ok()).toBe(true)
    await expect(second.json()).resolves.toEqual({ ok: true, idempotent: true })
    const afterSecond = await getE2ETransactionByCode(EDGE_FIXTURES.rounding.code)
    const effectsAfterSecond = await getE2ETransactionSideEffectState(EDGE_FIXTURES.rounding.code)

    expect(afterSecond).toMatchObject({
        id: afterFirst!.id,
        status: afterFirst!.status,
        sellDate: afterFirst!.sellDate,
        sellPrice: afterFirst!.sellPrice,
        profitStatus: afterFirst!.profitStatus,
        profitSharing: afterFirst!.profitSharing,
    })
    expect(effectsAfterSecond).toEqual(effectsAfterFirst)
    expect(effectsAfterSecond).toMatchObject({ profitSharing: 1, paymentHistories: 0 })

    const conflicting = await page.request.put(`/api/transactions/${seeded!.id}`, {
        data: {
            status: "COMPLETED",
            sellDate: "2026-08-21",
            sellPrice: EDGE_FIXTURES.rounding.sellPrice + 1,
            investorSharePercentage: EDGE_FIXTURES.rounding.investorSharePercentage,
            managerSharePercentage: EDGE_FIXTURES.rounding.managerSharePercentage,
        },
    })
    expect(conflicting.status()).toBe(409)
    await expect(conflicting.json()).resolves.toEqual({ error: "Transaction already completed with different finalization data" })
    expect(await getE2ETransactionByCode(EDGE_FIXTURES.rounding.code)).toMatchObject({
        sellDate: afterFirst!.sellDate,
        sellPrice: afterFirst!.sellPrice,
        profitStatus: afterFirst!.profitStatus,
        profitSharing: afterFirst!.profitSharing,
    })
    expect(await getE2ETransactionSideEffectState(EDGE_FIXTURES.rounding.code)).toEqual(effectsAfterFirst)
})
