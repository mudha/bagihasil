"use client"

import { Sidebar } from "@/components/layout/Sidebar"
import { Navbar } from "@/components/layout/Navbar"
import { Toaster } from "@/components/ui/sonner"
import { usePathname } from "next/navigation"

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
                {children}
                <Toaster />
            </div>
        )
    }

    return (
        <div className="h-full relative font-sans">
            <Navbar type="admin" />
            <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-gray-900 border-r border-gray-800">
                <Sidebar />
            </div>
            <main className="md:pl-72 pb-10 min-h-screen bg-gray-50/50">
                <div className="p-4 md:p-8">
                    {children}
                </div>
            </main>
            <Toaster />
        </div>
    )
}

