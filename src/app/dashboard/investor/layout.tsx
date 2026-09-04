import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { InvestorShell } from "./InvestorShell"

export default async function InvestorLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    if (session.user.role !== "INVESTOR") {
        // If Admin tries to access, maybe allow? But for now stick to separation.
        // Or redirect to main dashboard if not investor
        // redirect("/dashboard") 
    }

    return <InvestorShell>{children}</InvestorShell>
}

