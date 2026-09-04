import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { InvestorProfileView } from "../InvestorProfileView"

export default async function InvestorProfilePage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    // Get Investor
    const investor = await prisma.investor.findUnique({

        where: { userId: session.user.id }
    })

    if (!investor) return <div className="rounded-lg border border-red-200 bg-card p-6 text-red-700 shadow-sm dark:border-red-900/50 dark:text-red-300">Data Investor tidak ditemukan</div>

    return <InvestorProfileView investor={{
        name: investor.name,
        email: session.user.email || "-",
        contactInfo: investor.contactInfo || "-",
        marginPercentage: `${investor.marginPercentage}`,
        bankAccountDetails: investor.bankAccountDetails || "-",
    }} />
}
