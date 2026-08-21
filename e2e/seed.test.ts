import { describe, expect, it, vi } from "vitest"
import { cleanupAccessFixtures } from "./seed"

describe("RBAC E2E fixture cleanup safety", () => {
    it("refuses cleanup before writes when an E2E unit has a non-prefixed transaction", async () => {
        const direct = {
            unit: {
                findMany: vi.fn().mockResolvedValue([{ id: "e2e-unit" }]),
                deleteMany: vi.fn(),
            },
            transaction: {
                findMany: vi.fn().mockResolvedValue([
                    { id: "unexpected", transactionCode: "REAL-TX-001" },
                ]),
                deleteMany: vi.fn(),
            },
            investor: { deleteMany: vi.fn() },
            cost: { findMany: vi.fn(), deleteMany: vi.fn() },
            costProof: { deleteMany: vi.fn() },
            paymentHistory: { deleteMany: vi.fn() },
            transactionProof: { deleteMany: vi.fn() },
            profitSharing: { deleteMany: vi.fn() },
        }

        await expect(cleanupAccessFixtures(direct))
            .rejects.toThrow("refusing to delete non-prefixed transaction")
        expect(direct.transaction.deleteMany).not.toHaveBeenCalled()
        expect(direct.unit.deleteMany).not.toHaveBeenCalled()
        expect(direct.investor.deleteMany).not.toHaveBeenCalled()
    })
})
