import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const body = await req.json()
        const { data } = body

        if (!Array.isArray(data)) {
            return NextResponse.json({ error: "Invalid data format" }, { status: 400 })
        }

        let successCount = 0
        const errors: string[] = []

        // Pre-fetch all investors to minimize DB calls
        const investors = await prisma.investor.findMany()
        const investorMap = new Map(investors.map(i => [i.name.toLowerCase(), i.id]))

        for (let i = 0; i < data.length; i++) {
            const row = data[i]
            const { investorName, name, plateNumber, code, status } = row

            if (!investorName || !name || !code) {
                errors.push(`Row ${i + 1}: Missing required fields`)
                continue
            }

            const investorId = investorMap.get(investorName.toLowerCase())
            if (!investorId) {
                errors.push(`Row ${i + 1}: Investor '${investorName}' not found`)
                continue
            }

            try {
                await prisma.unit.create({
                    data: {
                        investorId,
                        name,
                        plateNumber: plateNumber || null,
                        code,
                        status: status || "AVAILABLE"
                    }
                })
                successCount++
            } catch (error: any) {
                if (error.code === 'P2002') {
                    errors.push(`Row ${i + 1}: Duplicate plate number or code`)
                } else {
                    errors.push(`Row ${i + 1}: ${error.message}`)
                }
            }
        }

        return NextResponse.json({ count: successCount, errors })
    } catch (error) {
        console.error("Import error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
