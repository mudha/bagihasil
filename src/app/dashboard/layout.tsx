"use client"

import { Sidebar } from "@/components/layout/Sidebar"
import { Navbar } from "@/components/layout/Navbar"
import { Toaster } from "@/components/ui/sonner"
import { usePathname } from "next/navigation"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    // Explicitly check for /dashboard/investor (singular) endpoint and its sub-routes
    // This ensures /dashboard/investors (plural) which is the admin page, is NOT treated as an investor page
    const isInvestorPage = pathname === "/dashboard/investor" || pathname?.startsWith("/dashboard/investor/")

    if (isInvestorPage) {
        return (
            <div className="h-full relative">
                <PullToRefresh>
                    {children}
                </PullToRefresh>
                <Toaster />
            </div>
        )
    }

    return (
        <div className="h-full relative overflow-x-hidden font-sans">
            <Navbar type="admin" />
            <div className="hidden h-full lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 z-[80] bg-gray-900 border-r border-gray-800">
                <Sidebar />
            </div>
            <main className="lg:pl-72 pb-10 min-h-screen bg-gray-50/50">
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

