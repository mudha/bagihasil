import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
    createUnitSelectState,
    updateUnitSelectState,
    type UnitSelectState,
} from "../../../lib/unit-form-select-state"

const initial = createUnitSelectState()
const page = readFileSync("src/app/dashboard/units/page.tsx", "utf8")

function rerender(state: UnitSelectState, action: Parameters<typeof updateUnitSelectState>[1]) {
    return updateUnitSelectState(state, action)
}

describe("Add Unit select state transitions", () => {
    it("keeps selections across unrelated field and preview updates", () => {
        let state = rerender(initial, { type: "vehicleType", value: "Motor", validBrands: ["Yamaha"] })
        state = rerender(state, { type: "brand", value: "Yamaha", validModels: ["XMAX"] })
        state = rerender(state, { type: "year", value: "2026" })
        state = rerender(state, { type: "color", value: "Hitam" })
        state = rerender(state, { type: "investor", value: "inv-1" })
        state = rerender(state, { type: "unrelatedField" })
        state = rerender(state, { type: "previewImage" })

        expect(state).toMatchObject({
            vehicleType: "Motor",
            brand: "Yamaha",
            year: "2026",
            color: "Hitam",
            investorId: "inv-1",
        })
    })

    it("disables brand before vehicle type and enables it after a valid type", () => {
        expect(initial.vehicleType).toBe("")
        expect(initial.brandEnabled).toBe(false)
        const state = rerender(initial, { type: "vehicleType", value: "Motor", validBrands: ["Yamaha"] })
        expect(state.vehicleType).toBe("Motor")
        expect(state.brandEnabled).toBe(true)
    })

    it("clears only incompatible brand/model when vehicle type changes", () => {
        let state = rerender(initial, { type: "vehicleType", value: "Mobil", validBrands: ["Toyota"] })
        state = rerender(state, { type: "brand", value: "Toyota", validModels: ["Avanza"] })
        state = rerender(state, { type: "model", value: "Avanza" })
        state = rerender(state, { type: "year", value: "2026" })
        state = rerender(state, { type: "color", value: "Putih" })
        state = rerender(state, { type: "investor", value: "inv-1" })
        state = rerender(state, { type: "vehicleType", value: "Motor", validBrands: ["Yamaha"] })

        expect(state).toMatchObject({
            vehicleType: "Motor",
            brand: "",
            model: "",
            year: "2026",
            color: "Putih",
            investorId: "inv-1",
            brandEnabled: true,
        })
    })

    it("preserves a compatible brand when vehicle type changes", () => {
        let state = rerender(initial, { type: "vehicleType", value: "Mobil", validBrands: ["Honda"] })
        state = rerender(state, { type: "brand", value: "Honda", validModels: ["Brio"] })
        state = rerender(state, { type: "vehicleType", value: "Mobil", validBrands: ["Honda"] })
        expect(state.brand).toBe("Honda")
    })

    it("wires Select callbacks as controlled state and resets only on dialog close", () => {
        expect(page).toContain("<Select value={vehicleType} onValueChange={setVehicleType}>")
        expect(page).toContain("<Select value={brand} onValueChange={setBrand} disabled={!vehicleType}>")
        expect(page).toContain("<Select value={year} onValueChange={setYear}>")
        expect(page).toContain("<Select value={color} onValueChange={setColor}>")
        expect(page).toContain("<Select onValueChange={field.onChange} value={field.value || \"\"}>")
        expect(page).toContain("if (!open) {")
        expect(page).toContain("setUnitSelectState(createUnitSelectState())")
        expect(page).not.toContain("} else {\n            form.reset({\n                name: \"\",\n                plateNumber: \"\",")
    })

    it("preserves the existing submit payload mapping and avoids UI mutation in tests", () => {
        expect(page).toContain("const payload = { ...values, imageUrl, stnkImageUrl }")
        expect(page).toContain("body: JSON.stringify(payload)")
        expect(page).toContain("method: method")
    })
})
