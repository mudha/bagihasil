import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { InvestorSidebar } from "@/components/layout/InvestorSidebar"
import { Navbar } from "@/components/layout/Navbar"
import { Toaster } from "@/components/ui/sonner"

export default async function InvestorLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    // @ts-ignore
    if (session.user.role !== "INVESTOR") {
        // If Admin tries to access, maybe allow? But for now stick to separation.
        // Or redirect to main dashboard if not investor
        // redirect("/dashboard") 
    }

    return (
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
            <Navbar type="investor" />
            <div className="flex flex-1 overflow-hidden">
                <InvestorSidebar className="hidden md:flex" />
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    {children}
                </main>
            </div>
            <Toaster />
        </div>
    )
}



