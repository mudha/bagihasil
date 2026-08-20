import { expect, test } from "@playwright/test"
import { cleanupE2EUsers, seedE2EUsers } from "../seed"
import { E2E_USERS } from "../test-env"
import {
    cleanupE2ETransactionFixtures,
    getE2ETransactionByCode,
    PAYMENT_FIXTURE,
    seedE2EPaymentFixture,
} from "../transaction-fixtures"

test.beforeEach(async () => {
    await seedE2EUsers()
    await seedE2EPaymentFixture()
})
test.afterEach(async () => {
    await cleanupE2ETransactionFixtures()
    await cleanupE2EUsers()
})

test("admin records partial then final payment through the real UI", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Username / Email").fill(E2E_USERS.admin.username)
    await page.getByLabel("Password").fill(E2E_USERS.admin.password)
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    const seeded = await getE2ETransactionByCode(PAYMENT_FIXTURE.code)
    expect(seeded).not.toBeNull()
    await page.goto(`/dashboard/transactions/${seeded!.id}`)
    await expect(page.getByText(PAYMENT_FIXTURE.code, { exact: true })).toBeVisible()

    const openDialog = page.getByRole("button", { name: "Tambah Pembayaran" })
    await openDialog.click()
    const dialog = page.getByRole("dialog", { name: "Tambah Pembayaran" })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel("Jumlah (Rp)").fill(String(PAYMENT_FIXTURE.firstPayment))
    await dialog.getByLabel("Tanggal Pembayaran").fill(PAYMENT_FIXTURE.paymentDate)
    await dialog.getByLabel("Catatan (Opsional)").fill(PAYMENT_FIXTURE.firstNotes)
    await dialog.getByRole("button", { name: "Simpan" }).click()
    await expect(page.getByText(/Pembayaran berhasil ditambahkan! Status: PARTIAL/).first()).toBeVisible()
    await expect(page.getByText("PARTIAL", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("Rp 3.000.000").first()).toBeVisible()

    await openDialog.click()
    await expect(dialog).toBeVisible()
    await dialog.getByLabel("Jumlah (Rp)").fill(String(PAYMENT_FIXTURE.secondPayment))
    await dialog.getByLabel("Tanggal Pembayaran").fill(PAYMENT_FIXTURE.paymentDate)
    await dialog.getByLabel("Catatan (Opsional)").fill(PAYMENT_FIXTURE.secondNotes)
    await dialog.getByRole("button", { name: "Simpan" }).click()
    await expect(page.getByText(/Pembayaran berhasil ditambahkan! Status: PAID/).first()).toBeVisible()
    await expect(page.getByText("PAID", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("Rp 8.000.000").first()).toBeVisible()

    const finalState = await getE2ETransactionByCode(PAYMENT_FIXTURE.code)
    expect(finalState?.paymentHistories).toHaveLength(2)
    expect(finalState).toMatchObject({
        paymentStatus: "PAID",
        paymentHistories: [
            { amount: PAYMENT_FIXTURE.firstPayment, method: "TRANSFER", notes: PAYMENT_FIXTURE.firstNotes },
            { amount: PAYMENT_FIXTURE.secondPayment, method: "TRANSFER", notes: PAYMENT_FIXTURE.secondNotes },
        ],
    })
})

test("payment endpoint rejects duplicate and overpayment without side effects", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Username / Email").fill(E2E_USERS.admin.username)
    await page.getByLabel("Password").fill(E2E_USERS.admin.password)
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    const seeded = await getE2ETransactionByCode(PAYMENT_FIXTURE.code)
    expect(seeded).not.toBeNull()
    const investorId = seeded!.unit.investorId
    const paymentDate = new Date(`${PAYMENT_FIXTURE.paymentDate}T00:00:00.000Z`).toISOString()
    const postPayment = (amount: number, notes: string) => page.evaluate(async ({ transactionId, investorId, amount, paymentDate, notes }) => {
        const response = await fetch(`/api/transactions/${transactionId}/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ investorId, amount, paymentDate, method: "TRANSFER", proofImageUrl: null, notes }),
        })
        return { status: response.status, body: await response.json() }
    }, { transactionId: seeded!.id, investorId, amount, paymentDate, notes })

    const firstPayment = await postPayment(PAYMENT_FIXTURE.firstPayment, PAYMENT_FIXTURE.firstNotes)
    expect(firstPayment.status).toBe(200)
    const secondPayment = await postPayment(PAYMENT_FIXTURE.secondPayment, PAYMENT_FIXTURE.secondNotes)
    expect(secondPayment.status).toBe(200)

    const duplicate = await postPayment(PAYMENT_FIXTURE.secondPayment, PAYMENT_FIXTURE.secondNotes)
    expect(duplicate.status).toBe(409)

    const overpayment = await postPayment(101, "E2E overpayment after paid")
    expect(overpayment.status).toBe(400)

    const finalState = await getE2ETransactionByCode(PAYMENT_FIXTURE.code)
    expect(finalState?.paymentHistories).toHaveLength(2)
    expect(finalState?.paymentStatus).toBe("PAID")
})
