"use client"

import type { ReactNode, WheelEvent } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Navbar } from "@/components/layout/Navbar"
import { Toaster } from "@/components/ui/sonner"
import { usePathname } from "next/navigation"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"

export default function DashboardLayout({
    children,
}: {
    children: ReactNode
}) {
    const pathname = usePathname()
    // Explicitly check for /dashboard/investor (singular) endpoint and its sub-routes
    // This ensures /dashboard/investors (plural) which is the admin page, is NOT treated as an investor page
    const isInvestorPage = pathname === "/dashboard/investor" || pathname?.startsWith("/dashboard/investor/")
    const handleDesktopSidebarWheel = (event: WheelEvent<HTMLDivElement>) => {
        if (typeof window === "undefined" || window.innerWidth < 1024) return
        window.scrollBy({ top: event.deltaY, left: 0, behavior: "auto" })
    }

    if (isInvestorPage) {
        return (
            <div className="relative min-h-screen">
                <PullToRefresh>
                    {children}
                </PullToRefresh>
                <Toaster />
            </div>
        )
    }

    return (
        <div className="relative min-h-screen overflow-x-hidden font-sans">
            <Navbar type="admin" />
            <div
                onWheel={handleDesktopSidebarWheel}
                className="hidden h-full lg:fixed lg:inset-y-0 lg:z-[80] lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-teal-900/20 lg:bg-[#062f2d]"
            >
                <Sidebar />
            </div>
            <main className="lg:pl-72 pb-10 min-h-screen bg-[linear-gradient(180deg,#f0fdfa_0%,#f8fafc_34%,#ffffff_100%)]">
                <PullToRefresh>
                    <div className="w-full max-w-[100vw] p-3 sm:p-4 lg:p-8">
                        {children}
                    </div>
                </PullToRefresh>
            </main>
            <Toaster />
        </div>
    )
}

