import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
    createUnitSelectState,
    updateUnitSelectState,
    type UnitSelectState,
} from "../../../lib/unit-form-select-state"

const page = readFileSync("src/app/dashboard/units/page.tsx", "utf8")
const dialogStart = page.indexOf("<Dialog open={isOpen}")
const dialogEnd = page.indexOf("</Dialog>", dialogStart)
const dialog = page.slice(dialogStart, dialogEnd)
const initializationEffect = page.slice(
    page.indexOf("useEffect(() => {\n        if (editingUnit)"),
    page.indexOf("const typeValue = form.watch", page.indexOf("useEffect(() => {\n        if (editingUnit)")),
)
const structuredValueEffect = page.slice(
    page.indexOf("// Update name based on selections"),
    page.indexOf("const handleScanStnk"),
)
const submit = page.slice(page.indexOf("async function onSubmit"), page.indexOf("async function handleDelete"))

function transition(state: UnitSelectState, action: Parameters<typeof updateUnitSelectState>[1]) {
    return updateUnitSelectState(state, action)
}

describe("Add Unit select state transitions", () => {
    it("persists the values used by the real controlled Select callbacks", () => {
        let state = createUnitSelectState()
        state = transition(state, { type: "vehicleType", value: "Motor", validBrands: ["Yamaha", "Honda"] })
        state = transition(state, { type: "brand", value: "Yamaha", validModels: ["XMAX"] })
        state = transition(state, { type: "model", value: "XMAX" })
        state = transition(state, { type: "year", value: "2026" })
        state = transition(state, { type: "color", value: "Hitam" })

        expect(state).toEqual({
            vehicleType: "Motor",
            brand: "Yamaha",
            model: "XMAX",
            year: "2026",
            color: "Hitam",
        })
    })

    it("clears an incompatible brand/model without clearing year or color", () => {
        let state = createUnitSelectState()
        state = transition(state, { type: "vehicleType", value: "Mobil", validBrands: ["Toyota"] })
        state = transition(state, { type: "brand", value: "Toyota", validModels: ["Avanza"] })
        state = transition(state, { type: "model", value: "Avanza" })
        state = transition(state, { type: "year", value: "2026" })
        state = transition(state, { type: "color", value: "Putih" })
        state = transition(state, { type: "vehicleType", value: "Motor", validBrands: ["Yamaha", "Honda"] })

        expect(state).toEqual({
            vehicleType: "Motor",
            brand: "",
            model: "",
            year: "2026",
            color: "Putih",
        })
    })

    it("preserves a compatible cross-type brand but clears its stale model", () => {
        let state = createUnitSelectState()
        state = transition(state, { type: "vehicleType", value: "Mobil", validBrands: ["Honda"] })
        state = transition(state, { type: "brand", value: "Honda", validModels: ["Brio"] })
        state = transition(state, { type: "model", value: "Brio" })
        state = transition(state, { type: "year", value: "2026" })
        state = transition(state, { type: "vehicleType", value: "Motor", validBrands: ["Honda"] })

        expect(state).toMatchObject({ vehicleType: "Motor", brand: "Honda", model: "", year: "2026" })
    })
})

describe("Add Unit component wiring contracts", () => {
    it("keeps every dialog Select portal above the z-100 Dialog overlay", () => {
        expect(dialog.match(/<SelectContent className="z-\[110\]">/g)).toHaveLength(7)
        expect(dialog).not.toMatch(/<SelectContent>/)
    })

    it("uses the helper state as the controlled source for vehicle selects", () => {
        expect(dialog).toContain("<Select value={vehicleType} onValueChange={setVehicleType}>")
        expect(dialog).toContain("<Select value={brand} onValueChange={setBrand} disabled={!vehicleType}>")
        expect(dialog).toContain("<Select value={year} onValueChange={setYear}>")
        expect(dialog).toContain("<Select value={color} onValueChange={setColor}>")
        expect(dialog).toContain("BRANDS[vehicleType as keyof typeof BRANDS]")
    })

    it("bridges every displayed vehicle value into the React Hook Form submit values", () => {
        for (const field of ["vehicleType", "brand", "model", "year", "color"]) {
            expect(structuredValueEffect.match(new RegExp(`form\\.setValue\\(\\"${field}\\"`, "g"))).toHaveLength(1)
        }
        expect(submit).toContain("const payload = { ...values, imageUrl, stnkImageUrl }")
        expect(submit).toContain("method: method")
        expect(submit).toContain("body: JSON.stringify(payload)")
    })

    it("keeps investor identity controlled by the React Hook Form investor ID", () => {
        expect(dialog).toContain("name=\"investorId\"")
        expect(dialog).toContain("<Select onValueChange={field.onChange} value={field.value || \"\"}>")
        expect(dialog).toContain("<SelectItem key={investor.id} value={investor.id}>")
    })

    it("initializes Edit atomically and resets Add state only on close or successful submit", () => {
        expect(initializationEffect).toContain("setUnitSelectState({")
        expect(initializationEffect.match(/form\.reset\(/g)).toHaveLength(1)
        expect(dialog).toContain("if (!open) {")
        expect(dialog).toContain("form.reset()")
        expect(dialog).toContain("setUnitSelectState(createUnitSelectState())")
        expect(submit).toContain("if (res.ok) {")
        expect(submit).toContain("setIsOpen(false)")
    })
})
