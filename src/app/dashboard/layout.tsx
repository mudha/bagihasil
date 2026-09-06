"use client"

import { Sidebar } from "@/components/layout/Sidebar"
import { Navbar } from "@/components/layout/Navbar"

import { usePathname } from "next/navigation"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const isInvestorPage = pathname === "/dashboard/investor" || pathname?.startsWith("/dashboard/investor/")

    if (isInvestorPage) {
        return (
            <div className="relative min-h-screen lg:h-dvh lg:overflow-hidden">
                <PullToRefresh>
                    {children}
                </PullToRefresh>
            </div>
        )
    }

    return (
        <div className="relative min-h-screen overflow-x-hidden font-sans lg:h-dvh lg:flex lg:flex-col lg:overflow-hidden">
            <Navbar type="admin" />
            <div className="hidden lg:fixed lg:inset-y-0 lg:z-[80] lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-teal-900/20 lg:bg-[#062f2d]">
                <Sidebar />
            </div>
            <main className="min-w-0 bg-[linear-gradient(180deg,var(--mudha-brand-soft)_0%,var(--background)_34%,var(--background)_100%)] pb-10 min-h-dvh lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pl-72">
                <PullToRefresh>
                    <div className="w-full max-w-[100vw] p-3 sm:p-4 lg:p-8">
                        {children}
                    </div>
                </PullToRefresh>
            </main>
        </div>
    )
}
