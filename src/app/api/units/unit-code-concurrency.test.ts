/**
 * Unit code generation concurrency audit.
 *
 * Tests prove:
 * 1. The TOCTOU race exists in the old next-code → create flow
 * 2. The new server-authoritative POST handler retries on P2002
 * 3. The retry pattern recovers from duplicate codes
 * 4. Code format and contract are preserved
 *
 * All tests use vi.mock('prisma') — no Production database.
 */
import { describe, expect, it, vi, beforeEach } from "vitest"

// ─── Mock setup ───────────────────────────────────────────────
const mockFindMany = vi.fn()
const mockFindUnique = vi.fn()
const mockInvestorFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockLogActivity = vi.fn()
const mockAuth = vi.fn()

vi.mock("@/lib/prisma", () => ({
    prisma: {
        unit: {
            findMany: mockFindMany,
            findUnique: mockFindUnique,
            create: mockCreate,
        },
        investor: {
            findUnique: mockInvestorFindUnique,
        },
    },
}))

vi.mock("@/lib/auth", () => ({
    auth: mockAuth,
}))

vi.mock("@/lib/activity-logger", () => ({
    logActivity: mockLogActivity,
}))

vi.mock("@/lib/api-auth", () => ({
    canReadAdminData: vi.fn(() => true),
    getInvestorForSession: vi.fn(),
}))

// ─── Code generation (mirrors server generateNextCode) ────────
async function generateNextCode(investorId?: string | null): Promise<string> {
    const { prisma } = await import("@/lib/prisma")
    let prefix = "UNT"

    if (investorId && investorId !== "all") {
        // Simplified — investor lookup not tested here
        prefix = "UNT-INV"
    }

    const existing = await prisma.unit.findMany({
        where: { code: { startsWith: prefix } },
        select: { code: true },
    })
    let max = 0
    for (const u of existing) {
        if (u.code) {
            const m = u.code.match(/(\d+)$/)
            if (m) {
                const n = parseInt(m[1])
                if (!isNaN(n) && n > max) max = n
            }
        }
    }
    const suffix = String(max + 1).padStart(4, "0")
    return `${prefix}-${suffix}`
}

// Simulate the server POST handler's retry logic
async function createUnitWithRetry(code: string, maxRetry = 5) {
    const { prisma } = await import("@/lib/prisma")
    let lastError: any = null

    for (let attempt = 0; attempt <= maxRetry; attempt++) {
        try {
            return await prisma.unit.create({
                data: { investorId: "inv1", name: "Test", code },
            })
        } catch (err: any) {
            lastError = err
            if (err?.code === "P2002" && attempt < maxRetry) {
                // In real handler, code would be regenerated here.
                // For test, we simulate by appending attempt number.
                code = code.replace(/\d{4}$/, String(parseInt(code.match(/(\d+)$/)![1]) + 1).padStart(4, "0"))
                continue
            }
            throw err
        }
    }
    throw lastError
}

// ─── Tests ────────────────────────────────────────────────────
beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { role: "ADMIN" } })
    mockInvestorFindUnique.mockResolvedValue({ name: "Wiwin Yuli Widiastuti" })
    mockLogActivity.mockResolvedValue(undefined)
})

describe("Unit code generation — TOCTOU race analysis (old flow)", () => {
    it("next-code returns same code to concurrent callers (proves TOCTOU)", async () => {
        mockFindMany.mockResolvedValue([
            { code: "UNT-0003" },
            { code: "UNT-0004" },
        ])
        mockFindUnique.mockResolvedValue(null)

        const [code1, code2] = await Promise.all([
            generateNextCode(),
            generateNextCode(),
        ])

        // Both get UNT-0005 — this IS the race condition
        expect(code1).toBe("UNT-0005")
        expect(code2).toBe("UNT-0005")
        expect(code1).toBe(code2)
    })
})

describe("Unit code generation — server-authoritative POST (new flow)", () => {
    it("creates unit with server-generated code", async () => {
        mockCreate.mockResolvedValueOnce({
            id: "unit1",
            code: "UNT-0001",
            name: "Test",
        })

        const result = await createUnitWithRetry("UNT-0001")
        expect(result.code).toBe("UNT-0001")
        expect(mockCreate).toHaveBeenCalledOnce()
    })

    it("retries on P2002 with next code and succeeds", async () => {
        mockCreate
            .mockRejectedValueOnce(
                Object.assign(new Error("Unique constraint failed"), {
                    code: "P2002",
                    meta: { target: ["code"] },
                })
            )
            .mockResolvedValueOnce({
                id: "unit2",
                code: "UNT-0002",
                name: "Test",
            })

        const result = await createUnitWithRetry("UNT-0001")
        expect(result.code).toBe("UNT-0002")
        expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it("exhausts retries and throws after MAX_RETRY failures", async () => {
        const p2002 = Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
            meta: { target: ["code"] },
        })
        // All 6 attempts (0..5) fail
        mockCreate.mockRejectedValue(p2002)

        await expect(createUnitWithRetry("UNT-0001", 5)).rejects.toThrow(
            "Unique constraint failed"
        )
        expect(mockCreate).toHaveBeenCalledTimes(6)
    })

    it("does NOT retry on non-P2002 errors", async () => {
        mockCreate.mockRejectedValueOnce(
            Object.assign(new Error("Connection refused"), {
                code: "P1001",
            })
        )

        await expect(createUnitWithRetry("UNT-0001")).rejects.toThrow(
            "Connection refused"
        )
        expect(mockCreate).toHaveBeenCalledOnce()
    })
})

describe("Production POST handler contracts", () => {
    const request = () => new Request("http://localhost/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            investorId: "investor-wiwin",
            name: "XMAX",
            plateNumber: "B 1234 XYZ",
            code: "CLIENT-SHOULD-BE-IGNORED",
        }),
    })

    it("uses the actual investor prefix, ignores client code, and preserves the response", async () => {
        mockFindMany.mockResolvedValue([{ code: "UNT-WIW-0013" }])
        mockCreate.mockImplementation(async ({ data }) => ({ id: "u1", ...data }))
        const { POST } = await import("./route")

        const response = await POST(request())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.code).toBe("UNT-WIW-0014")
        expect(mockInvestorFindUnique).toHaveBeenCalledWith({ where: { id: "investor-wiwin" }, select: { name: true } })
        expect(mockCreate.mock.calls[0][0].data.code).not.toBe("CLIENT-SHOULD-BE-IGNORED")
        expect(mockLogActivity).toHaveBeenCalledOnce()
    })

    it("regenerates a fresh code after a code-field P2002", async () => {
        mockFindMany
            .mockResolvedValueOnce([{ code: "UNT-WIW-0013" }])
            .mockResolvedValueOnce([{ code: "UNT-WIW-0013" }, { code: "UNT-WIW-0014" }])
        mockCreate
            .mockRejectedValueOnce(Object.assign(new Error("conflict"), { code: "P2002", meta: { target: ["code"] } }))
            .mockImplementationOnce(async ({ data }) => ({ id: "u2", ...data }))
        const { POST } = await import("./route")

        const response = await POST(request())
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(mockCreate.mock.calls.map(call => call[0].data.code)).toEqual(["UNT-WIW-0014", "UNT-WIW-0015"])
        expect(body.code).toBe("UNT-WIW-0015")
        expect(mockLogActivity).toHaveBeenCalledOnce()
    })

    it("does not retry P2002 for another unique field and hides Prisma details", async () => {
        mockFindMany.mockResolvedValue([])
        mockCreate.mockRejectedValueOnce(Object.assign(new Error("Unique constraint failed on plateNumber"), {
            code: "P2002", meta: { target: ["plateNumber"] },
        }))
        const { POST } = await import("./route")

        const response = await POST(request())
        const body = await response.json()

        expect(response.status).toBe(500)
        expect(mockCreate).toHaveBeenCalledOnce()
        expect(body).toEqual({ error: "Internal Server Error" })
        expect(JSON.stringify(body)).not.toMatch(/P2002|plateNumber|Prisma/i)
        expect(response.headers.get("cache-control")).toBe("private, no-store")
        expect(mockLogActivity).not.toHaveBeenCalled()
    })

    it("returns standard 409 after bounded code-conflict exhaustion", async () => {
        mockFindMany.mockResolvedValue([])
        mockCreate.mockRejectedValue(Object.assign(new Error("conflict"), { code: "P2002", meta: { target: ["code"] } }))
        const { POST } = await import("./route")

        const response = await POST(request())
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(mockCreate).toHaveBeenCalledTimes(6)
        expect(body.error).toContain("Silakan coba lagi")
        expect(response.headers.get("cache-control")).toBe("private, no-store")
        expect(mockLogActivity).not.toHaveBeenCalled()
    })
})

describe("Unit code generation — correctness", () => {
    it("generates 4-digit padded code with UNT prefix", async () => {
        mockFindMany.mockResolvedValue([])
        const code = await generateNextCode()
        expect(code).toMatch(/^UNT-\d{4}$/)
        expect(code).toBe("UNT-0001")
    })

    it("increments past existing codes", async () => {
        mockFindMany.mockResolvedValue([
            { code: "UNT-0010" },
            { code: "UNT-0011" },
        ])
        const code = await generateNextCode()
        expect(code).toBe("UNT-0012")
    })

    it("handles codes with different digit lengths correctly", async () => {
        mockFindMany.mockResolvedValue([
            { code: "UNT-0003" },
            { code: "UNT-0047" },
        ])
        const code = await generateNextCode()
        expect(code).toBe("UNT-0048")
    })
})
