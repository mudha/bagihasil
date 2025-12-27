"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Wallet, LogOut, PieChart, User } from "lucide-react"
import { signOut } from "next-auth/react"

interface InvestorSidebarProps {
    className?: string
    onNavigate?: () => void
}

export function InvestorSidebar({ className, onNavigate }: InvestorSidebarProps) {
    const pathname = usePathname()

    return (
        <div className={cn("h-full w-64 flex-col border-r bg-white p-4 dark:bg-gray-800 flex", className)}>
            <div className="flex h-14 items-center border-b px-2 font-bold text-xl mb-4">
                <span className="text-emerald-600 mr-2">Investor</span> Portal
            </div>
            <div className="flex-1 space-y-1">
                <Link href="/dashboard/investor" onClick={onNavigate}>
                    <Button variant={pathname === "/dashboard/investor" ? "secondary" : "ghost"} className="w-full justify-start gap-2">
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                    </Button>
                </Link>
                <Link href="/dashboard/investor/investments" onClick={onNavigate}>
                    <Button variant={pathname?.startsWith("/dashboard/investor/investments") ? "secondary" : "ghost"} className="w-full justify-start gap-2">
                        <PieChart className="h-4 w-4" />
                        Investasi Saya
                    </Button>
                </Link>
                <Link href="/dashboard/investor/payments" onClick={onNavigate}>
                    <Button variant={pathname?.startsWith("/dashboard/investor/payments") ? "secondary" : "ghost"} className="w-full justify-start gap-2">
                        <Wallet className="h-4 w-4" />
                        Riwayat Pembayaran
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
                    <p>Investor Portal v1.0</p>
                    <p>&copy; 2025 Mudha</p>
                </div>
            </div>
        </div>
    )
}
