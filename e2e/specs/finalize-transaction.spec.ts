import { expect, test } from "@playwright/test"
import { cleanupE2EUsers, seedE2EUsers } from "../seed"
import { E2E_USERS } from "../test-env"
import {
    cleanupE2ETransactionFixtures,
    FINALIZATION_FIXTURE,
    getE2ETransactionByCode,
    seedE2EFinalizationFixture,
} from "../transaction-fixtures"

test.beforeAll(async () => {
    await seedE2EUsers()
    await seedE2EFinalizationFixture()
})
test.afterAll(async () => {
    await cleanupE2ETransactionFixtures()
    await cleanupE2EUsers()
})

test("admin finalizes a profitable transaction without payment", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Username / Email").fill(E2E_USERS.admin.username)
    await page.getByLabel("Password").fill(E2E_USERS.admin.password)
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    const seeded = await getE2ETransactionByCode(FINALIZATION_FIXTURE.code)
    expect(seeded).not.toBeNull()
    await page.goto(`/dashboard/transactions/${seeded!.id}`)
    await expect(page.getByText(FINALIZATION_FIXTURE.code, { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Finalisasi Penjualan" }).click()

    const dialog = page.getByRole("dialog", { name: "Finalisasi Penjualan Unit" })
    await expect(dialog).toBeVisible()
    await dialog.locator('input[type="date"]').fill(FINALIZATION_FIXTURE.sellDate)
    const numberInputs = dialog.locator('input[type="number"]')
    await numberInputs.nth(0).fill(String(FINALIZATION_FIXTURE.sellPrice))
    await numberInputs.nth(1).fill(String(FINALIZATION_FIXTURE.investorSharePercentage))
    await numberInputs.nth(2).fill(String(FINALIZATION_FIXTURE.managerSharePercentage))
    await dialog.getByPlaceholder("Catatan akhir...").fill(FINALIZATION_FIXTURE.notes)
    await dialog.getByRole("button", { name: "Proses & Simpan" }).click()

    await expect(page.getByText("Transaksi berhasil diselesaikan!").first()).toBeVisible()
    await expect(dialog).toBeHidden()
    await expect(page.getByText("COMPLETED", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("Hasil Penjualan", { exact: true })).toBeVisible()
    await expect(page.getByText("Rp 20.000.000").first()).toBeVisible()
    await expect(page.getByText("Rp 8.000.000").first()).toBeVisible()
    await expect(page.getByText("Rp 12.000.000").first()).toBeVisible()

    const transaction = await getE2ETransactionByCode(FINALIZATION_FIXTURE.code)
    expect(transaction?.sellDate?.toISOString()).toBe("2026-08-21T00:00:00.000Z")
    expect(transaction).toMatchObject({
        transactionCode: FINALIZATION_FIXTURE.code,
        buyPrice: FINALIZATION_FIXTURE.buyPrice,
        sellPrice: FINALIZATION_FIXTURE.sellPrice,
        status: "COMPLETED",
        paymentStatus: "UNPAID",
        notes: FINALIZATION_FIXTURE.notes,
        profitStatus: "PROFIT",
        lossBearer: null,
        buyProofImageUrl: null,
        buyProofDescription: null,
        sellProofImageUrl: null,
        sellProofDescription: "Bukti Pelunasan Unit",
        costs: [],
        paymentHistories: [],
        proofs: [],
        unit: {
            code: FINALIZATION_FIXTURE.unitCode,
            status: "SOLD",
        },
        profitSharing: {
            netMargin: 20_000_000,
            investorSharePercentage: 40,
            managerSharePercentage: 60,
            investorProfitAmount: 8_000_000,
            managerProfitAmount: 12_000_000,
            totalCapitalInvestor: 40_000_000,
            totalCapitalManager: 10_000_000,
            totalCapital: 50_000_000,
        },
    })
})

// Keep the fixture module's exact-code guard exercised by this write scenario.
test("finalization fixture query rejects a non-E2E code", async () => {
    await expect(getE2ETransactionByCode("TRX-PRODUCTION-001"))
        .rejects.toThrow("refusing to inspect a non-E2E transaction code")
})

// The second test is read-only and does not create or mutate financial data.
