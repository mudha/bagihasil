import { describe, expect, it } from "vitest"
import { getInvestorInitials } from "./investor-initials"

describe("getInvestorInitials", () => {
    it.each([
        ["Wahyu Prasetyo Adi", "WP"],
        ["  Wahyu   Prasetyo  ", "WP"],
        ["wahyu", "W"],
        ["", "?"],
        ["   ", "?"],
        [null, "?"],
        [undefined, "?"],
    ])("maps %j to %s", (name, expected) => {
        expect(getInvestorInitials(name)).toBe(expected)
    })
})
