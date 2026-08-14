"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    Car,
    Users,
    FileText,
    LogOut,
    Calculator,
    History,
    UserCog
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import { BrandMark } from "./BrandMark"
import { signOutToLogin } from "@/lib/sign-out"

const routes = [
    {
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/dashboard",
        color: "text-sky-500",
        featured: true,
    },
    {
        label: "Unit Kendaraan",
        icon: Car,
        href: "/dashboard/units",
        color: "text-violet-500",
        featured: true,
    },
    {
        label: "Transaksi",
        icon: FileText,
        href: "/dashboard/transactions",
        color: "text-pink-700",
        featured: true,
    },
    {
        label: "Pemodal",
        icon: Users,
        href: "/dashboard/investors",
        color: "text-orange-700",
        featured: true,
    },
    {
        label: "Kalkulator",
        icon: Calculator,
        href: "/dashboard/calculator",
        color: "text-emerald-500",
    },
    {
        label: "Aktivitas",
        icon: History,
        href: "/dashboard/activity-logs",
        color: "text-gray-500",
    },
    {
        label: "Kelola User",
        icon: UserCog,
        href: "/dashboard/users",
        color: "text-red-500",
        adminOnly: true,
    },
]

interface SidebarProps {
    onNavigate?: () => void
    compact?: boolean
}

export function Sidebar({ onNavigate, compact = false }: SidebarProps) {
    const pathname = usePathname()
    const { data: session, status } = useSession()
    const visibleRoutes = routes.filter(route => {
        if (route.adminOnly) {
            return status === "loading" || session?.user?.role === "ADMIN"
        }
        return true
    })
    const primaryRoutes = compact ? visibleRoutes.filter(route => route.featured) : visibleRoutes
    const secondaryRoutes = compact ? visibleRoutes.filter(route => !route.featured) : []

    return (
        <div className="flex h-full min-h-0 flex-col bg-[#062f2d] text-white">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
                <Link href="/dashboard" className="mb-8 mt-3 flex items-center rounded-lg px-2 py-3" onClick={onNavigate}>
                    <BrandMark inverse />
                </Link>
                <div className="space-y-1.5">
                    {primaryRoutes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            onClick={onNavigate}
                            className={cn(
                                "group flex w-full cursor-pointer justify-start rounded-lg p-3 text-sm font-semibold transition",
                                pathname === route.href ? "bg-white text-teal-950 shadow-sm" : "text-teal-50/70 hover:bg-white/10 hover:text-white"
                            )}
                        >
                            <div className="flex items-center flex-1">
                                <route.icon className={cn("mr-3 h-5 w-5", pathname === route.href ? "text-teal-600" : route.color)} />
                                {route.label}
                            </div>
                        </Link>
                    ))}
                    {secondaryRoutes.length > 0 && (
                        <details className="group pt-3">
                            <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-100/60">
                                Lainnya
                                <span className="text-base transition group-open:rotate-45">+</span>
                            </summary>
                            <div className="mt-1 space-y-1.5">
                                {secondaryRoutes.map((route) => (
                                    <Link
                                        key={route.href}
                                        href={route.href}
                                        onClick={onNavigate}
                                        className={cn(
                                            "group flex w-full cursor-pointer justify-start rounded-lg p-3 text-sm font-semibold transition",
                                            pathname === route.href ? "bg-white text-teal-950 shadow-sm" : "text-teal-50/70 hover:bg-white/10 hover:text-white"
                                        )}
                                    >
                                        <div className="flex items-center flex-1">
                                            <route.icon className={cn("mr-3 h-5 w-5", pathname === route.href ? "text-teal-600" : route.color)} />
                                            {route.label}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </details>
                    )}
                </div>
            </div>
            <div className="mt-auto shrink-0 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                <Button
                    onClick={signOutToLogin}
                    variant="ghost"
                    className="w-full justify-start text-teal-50/70 hover:bg-white/10 hover:text-white"
                >
                    <LogOut className="h-5 w-5 mr-3" />
                    Logout
                </Button>
                <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-xs text-teal-50/55">
                    <p className="font-semibold text-teal-50/75">Mudha Profit Studio</p>
                    <p>&copy; 2026 Mudha</p>
                </div>
            </div>
        </div>
    )
}
