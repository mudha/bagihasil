"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, LogOut, User } from "lucide-react"
import { signOut } from "next-auth/react"
import { BrandMark } from "./BrandMark"

interface InvestorSidebarProps {
    className?: string
    onNavigate?: () => void
}

export function InvestorSidebar({ className, onNavigate }: InvestorSidebarProps) {
    const pathname = usePathname()

    return (
        <div className={cn("flex h-full w-64 flex-col border-r border-teal-900/10 bg-white p-4 dark:bg-gray-800", className)}>
            <div className="mb-4 flex h-16 items-center border-b px-2">
                <BrandMark />
            </div>
            <div className="flex-1 space-y-1">
                <Link href="/dashboard/investor" onClick={onNavigate}>
                    <Button variant={pathname === "/dashboard/investor" ? "secondary" : "ghost"} className="w-full justify-start gap-2">
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                    </Button>
                </Link>

                <Link href="/dashboard/investor/profile" onClick={onNavigate}>
                    <Button variant={pathname?.startsWith("/dashboard/investor/profile") ? "secondary" : "ghost"} className="w-full justify-start gap-2">
                        <User className="h-4 w-4" />
                        Profil Saya
                    </Button>
                </Link>
            </div>
            <div className="border-t pt-4 mt-auto">
                <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-red-500 hover:text-red-600"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                >
                    <LogOut className="h-4 w-4" />
                    Keluar
                </Button>
                <div className="mt-4 text-xs text-gray-400 text-center">
                    <p>Mudha Investor Studio</p>
                    <p>&copy; 2026 Mudha</p>
                </div>
            </div>
        </div>
    )
}
