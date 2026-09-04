import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { InvestorSidebar } from "@/components/layout/InvestorSidebar"
import { Navbar } from "@/components/layout/Navbar"


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

    return (
        <div className="flex min-h-dvh flex-col overflow-x-hidden bg-background font-sans">
            <Navbar type="investor" />
            <div className="flex flex-1 min-h-0">
                <InvestorSidebar className="hidden lg:flex" />
                <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-8 touch-scroll">
                    {children}
                </main>
            </div>

        </div>
    )
}



