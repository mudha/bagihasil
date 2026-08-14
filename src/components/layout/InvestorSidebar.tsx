"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, LogOut, User } from "lucide-react"
import { BrandMark } from "./BrandMark"
import { signOutToLogin } from "@/lib/sign-out"

interface InvestorSidebarProps {
    className?: string
    onNavigate?: () => void
}

export function InvestorSidebar({ className, onNavigate }: InvestorSidebarProps) {
    const pathname = usePathname()

    return (
        <div className={cn("flex h-full min-h-0 w-64 flex-col border-r border-teal-900/20 bg-[#062f2d] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-teal-50", className)}>
            <div className="mb-4 flex h-16 items-center border-b border-white/10 px-2">
                <BrandMark />
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
                <Link href="/dashboard/investor" onClick={onNavigate}>
                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full justify-start gap-2 rounded-lg text-teal-100 hover:bg-white/10 hover:text-white",
                            pathname === "/dashboard/investor" && "bg-white text-teal-950 hover:bg-white hover:text-teal-950"
                        )}
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                    </Button>
                </Link>

                <Link href="/dashboard/investor/profile" onClick={onNavigate}>
                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full justify-start gap-2 rounded-lg text-teal-100 hover:bg-white/10 hover:text-white",
                            pathname?.startsWith("/dashboard/investor/profile") && "bg-white text-teal-950 hover:bg-white hover:text-teal-950"
                        )}
                    >
                        <User className="h-4 w-4" />
                        Profil Saya
                    </Button>
                </Link>
            </div>
            <div className="mt-auto shrink-0 border-t border-white/10 pt-4">
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 rounded-lg text-teal-100 hover:bg-white/10 hover:text-white"
                    onClick={signOutToLogin}
                >
                    <LogOut className="h-4 w-4" />
                    Keluar
                </Button>
                <div className="mt-4 rounded-lg bg-white/10 p-3 text-xs leading-relaxed text-teal-50/70">
                    <p className="font-bold text-teal-50">Mudha Investor Studio</p>
                    <p>&copy; 2026 Mudha</p>
                </div>
            </div>
        </div>
    )
}
