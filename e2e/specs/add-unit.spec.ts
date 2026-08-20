import { expect, test, type Locator, type Page } from "@playwright/test"
import { E2E_USERS } from "../test-env"
import {
    cleanupE2EFinancialFixtures,
    getE2EUnitByCode,
    seedE2EFinancialFixtures,
    UNIT_FIXTURE,
} from "../unit-fixtures"

async function choose(page: Page, dialog: Locator, label: string, option: string) {
    const field = dialog.getByText(label, { exact: true }).locator("..")
    await field.getByRole("combobox").click()
    await page.getByRole("option", { name: option, exact: true }).click()
}

test.beforeAll(seedE2EFinancialFixtures)
test.afterAll(cleanupE2EFinancialFixtures)

test("admin adds an isolated unit through the real dialog", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Username / Email").fill(E2E_USERS.admin.username)
    await page.getByLabel("Password").fill(E2E_USERS.admin.password)
    await page.getByRole("button", { name: "Login" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.goto("/dashboard/units")
    await page.getByRole("button", { name: /Tambah Unit/ }).click()
    const dialog = page.getByRole("dialog", { name: "Tambah Unit Baru" })
    await expect(dialog).toBeVisible()

    await choose(page, dialog, "Jenis Kendaraan", UNIT_FIXTURE.vehicleType)
    await choose(page, dialog, "Tahun", UNIT_FIXTURE.year)
    await choose(page, dialog, "Merek", UNIT_FIXTURE.brand)
    await choose(page, dialog, "Model", UNIT_FIXTURE.model)
    await choose(page, dialog, "Warna", UNIT_FIXTURE.color)
    await choose(page, dialog, "Pemilik Modal", UNIT_FIXTURE.investorName)

    await dialog.getByPlaceholder("Contoh: 1.5 G CVT, ABS, TRD").fill(UNIT_FIXTURE.type)
    await dialog.getByPlaceholder("Contoh: 15000").fill(String(UNIT_FIXTURE.kilometer))
    await dialog.getByPlaceholder("B 1234 ABC").fill(UNIT_FIXTURE.plateNumber)
    await dialog.getByPlaceholder("UNT-INV-001").fill(UNIT_FIXTURE.code)
    await dialog.getByRole("button", { name: "Simpan Unit" }).click()

    await expect(page.getByText("Unit berhasil ditambahkan").first()).toBeVisible()
    await expect(dialog).toBeHidden()
    await page.getByPlaceholder("Cari unit...").fill(UNIT_FIXTURE.code)
    const unitRow = page.getByRole("row").filter({
        has: page.getByRole("cell", { name: UNIT_FIXTURE.code, exact: true }),
    })
    await expect(unitRow).toBeVisible()
    await expect(unitRow).toContainText(UNIT_FIXTURE.expectedName)

    expect(await getE2EUnitByCode(UNIT_FIXTURE.code)).toMatchObject({
        code: UNIT_FIXTURE.code,
        name: UNIT_FIXTURE.expectedName,
        plateNumber: UNIT_FIXTURE.plateNumber,
        status: "AVAILABLE",
        vehicleType: UNIT_FIXTURE.vehicleType,
        brand: UNIT_FIXTURE.brand,
        model: UNIT_FIXTURE.model,
        type: UNIT_FIXTURE.type,
        year: UNIT_FIXTURE.year,
        color: UNIT_FIXTURE.color,
        kilometer: UNIT_FIXTURE.kilometer,
        investor: { name: UNIT_FIXTURE.investorName },
    })
})
