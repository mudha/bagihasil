import { describe, expect, it } from "vitest"
import { getE2EUnitByCode } from "./unit-fixtures"

describe("E2E unit fixture guard", () => {
    it("rejects inspection of a non-E2E unit code before opening a database client", async () => {
        await expect(getE2EUnitByCode("UNIT-PRODUCTION-001"))
            .rejects.toThrow("refusing to inspect a non-E2E unit code")
    })
})
