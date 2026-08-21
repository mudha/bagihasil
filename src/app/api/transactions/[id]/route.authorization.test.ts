import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const routeSource = readFileSync(new URL("./route.ts", import.meta.url), "utf8")

function getTransactionBody(source: string) {
    const start = source.indexOf("export async function GET(")
    const end = source.indexOf("export async function PUT(")
    if (start === -1 || end === -1) throw new Error("GET transaction route could not be located")
    return source.slice(start, end)
}

describe("transaction detail authorization order", () => {
    it("checks investor ownership before loading sensitive transaction relations", () => {
        const body = getTransactionBody(routeSource)
        const accessCheck = body.indexOf("await canAccessTransaction(session, id)")
        const sensitiveQuery = body.indexOf("const transaction = await prisma.transaction.findUnique(")

        expect(accessCheck).toBeGreaterThan(-1)
        expect(sensitiveQuery).toBeGreaterThan(accessCheck)
        expect(body.slice(accessCheck, sensitiveQuery)).toContain("Transaction not found")
        expect(body.slice(accessCheck, sensitiveQuery)).toContain("status: 404")
    })
})
