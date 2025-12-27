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
import { signOut, useSession } from "next-auth/react"

const routes = [
    {
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/dashboard",
        color: "text-sky-500",
    },
    {
        label: "Unit Kendaraan",
        icon: Car,
        href: "/dashboard/units",
        color: "text-violet-500",
    },
    {
        label: "Transaksi",
        icon: FileText,
        href: "/dashboard/transactions",
        color: "text-pink-700",
    },
    {
        label: "Pemodal",
        icon: Users,
        href: "/dashboard/investors",
        color: "text-orange-700",
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
}

export function Sidebar({ onNavigate }: SidebarProps) {
    const pathname = usePathname()
    const { data: session } = useSession()

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-[#111827] text-white">
            <div className="px-3 py-2 flex-1">
                <Link href="/dashboard" className="flex items-center pl-3 mb-14" onClick={onNavigate}>
                    <h1 className="text-2xl font-bold">
                        Profit Share
                    </h1>
                </Link>
                <div className="space-y-1">
                    {routes.filter(route => {
                        if (route.adminOnly) {
                            // @ts-ignore
                            return session?.user?.role === "ADMIN"
                        }
                        return true
                    }).map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            onClick={onNavigate}
                            className={cn(
                                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                                pathname === route.href ? "text-white bg-white/10" : "text-zinc-400"
                            )}
                        >
                            <div className="flex items-center flex-1">
                                <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                                {route.label}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
            <div className="px-3 py-2 mt-auto">
                <Button
                    onClick={() => signOut()}
                    variant="ghost"
                    className="w-full justify-start text-zinc-400 hover:text-white hover:bg-white/10"
                >
                    <LogOut className="h-5 w-5 mr-3" />
                    Logout
                </Button>
                <div className="mt-4 px-3 text-xs text-zinc-600">
                    <p>Profit Share App v1.0</p>
                    <p>&copy; 2025 Mudha</p>
                </div>
            </div>
        </div>
    )
}
