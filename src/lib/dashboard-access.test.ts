import { describe, expect, it } from "vitest"

import { investorStatsScope } from "./dashboard-access"

describe("dashboard investor statistics scope", () => {
    it("scopes investor statistics to the logged-in investor", () => {
        expect(investorStatsScope("investor-own")).toEqual({ id: "investor-own" })
    })

    it("does not restrict ADMIN or VIEWER statistics when no investor scope is set", () => {
        expect(investorStatsScope(null)).toBeUndefined()
    })
})
