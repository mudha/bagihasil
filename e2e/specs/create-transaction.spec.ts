import { expect, test } from "@playwright/test"
import { E2E_USERS } from "../test-env"
import { cleanupE2EUsers, seedE2EUsers } from "../seed"
import {
    cleanupE2ETransactionFixtures,
    getE2ETransactionByCode,
    seedE2ETransactionFixtures,
    TRANSACTION_FIXTURE,
} from "../transaction-fixtures"
import { UNIT_FIXTURE } from "../unit-fixtures"

test.beforeAll(async () => {
    await seedE2EUsers()
    await seedE2ETransactionFixtures()
})
test.afterAll(async () => {
    await cleanupE2ETransactionFixtures()
    await cleanupE2EUsers()
})

test("admin creates a basic purchase transaction without finalization", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Username / Email").fill(E2E_USERS.admin.username)
    await page.getByLabel("Password").fill(E2E_USERS.admin.password)
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.goto("/dashboard/transactions")
    await page.getByRole("button", { name: "Transaksi Baru" }).click()
    const dialog = page.getByRole("dialog", { name: "Mulai Transaksi Baru" })
    await expect(dialog).toBeVisible()

    await dialog.getByText("Pilih Unit", { exact: true }).locator("..").getByRole("combobox").click()
    await page.getByRole("option", {
        name: `${UNIT_FIXTURE.expectedName} - ${UNIT_FIXTURE.plateNumber}`,
        exact: true,
    }).click()

    await dialog.getByPlaceholder("TRX-2024-001").fill(TRANSACTION_FIXTURE.code)
    await dialog.locator('input[type="date"]').fill(TRANSACTION_FIXTURE.buyDate)
    await dialog.getByPlaceholder("0", { exact: true }).first()
        .fill(String(TRANSACTION_FIXTURE.buyPrice))
    await dialog.getByPlaceholder("Kosongkan jika sama dengan harga beli")
        .fill(String(TRANSACTION_FIXTURE.initialInvestorCapital))
    await dialog.getByPlaceholder("0", { exact: true }).last()
        .fill(String(TRANSACTION_FIXTURE.initialManagerCapital))
    await dialog.getByPlaceholder("Catatan tambahan...").fill(TRANSACTION_FIXTURE.notes)
    await dialog.getByRole("button", { name: "Simpan Transaksi" }).click()

    await expect(page.getByText("Transaksi berhasil dibuat").first()).toBeVisible()
    await expect(dialog).toBeHidden()
    await page.getByPlaceholder("Cari transaksi...", { exact: true }).fill(TRANSACTION_FIXTURE.code)
    const row = page.getByRole("row").filter({
        has: page.getByRole("cell", { name: TRANSACTION_FIXTURE.code, exact: true }),
    })
    await expect(row).toBeVisible()
    await expect(row).toContainText("ON_PROCESS")

    const transaction = await getE2ETransactionByCode(TRANSACTION_FIXTURE.code)
    expect(transaction?.buyDate.toISOString()).toBe("2026-08-20T00:00:00.000Z")
    expect(transaction).toMatchObject({
        transactionCode: TRANSACTION_FIXTURE.code,
        buyPrice: TRANSACTION_FIXTURE.buyPrice,
        initialInvestorCapital: TRANSACTION_FIXTURE.initialInvestorCapital,
        initialManagerCapital: TRANSACTION_FIXTURE.initialManagerCapital,
        notes: TRANSACTION_FIXTURE.notes,
        status: "ON_PROCESS",
        paymentStatus: "UNPAID",
        sellDate: null,
        sellPrice: null,
        profitStatus: null,
        lossBearer: null,
        buyProofImageUrl: null,
        buyProofDescription: null,
        sellProofImageUrl: null,
        sellProofDescription: null,
        profitSharing: null,
        costs: [],
        paymentHistories: [],
        proofs: [],
        unit: {
            code: UNIT_FIXTURE.code,
            status: "AVAILABLE",
            investor: { name: UNIT_FIXTURE.investorName },
        },
    })
})
