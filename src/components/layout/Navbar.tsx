"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Sidebar } from "./Sidebar"
import { InvestorSidebar } from "./InvestorSidebar"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BrandMark } from "./BrandMark"
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher"

interface NavbarProps {
    type?: "admin" | "investor"
}

export function Navbar({ type = "admin" }: NavbarProps) {
    const [isMounted, setIsMounted] = useState(false)
    const [open, setOpen] = useState(false)
    const pathname = usePathname()
    const { data: session } = useSession()

    useEffect(() => {
        setIsMounted(true)
    }, [])

    useEffect(() => {
        setOpen(false)
    }, [pathname])

    if (!isMounted) {
        return null
    }

    const getInitials = (name?: string | null) => {
        if (!name) return "U"
        return name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2)
    }

    return (
        <div className={type === "admin"
            ? "sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-teal-900/10 bg-card/85 p-3 shadow-sm backdrop-blur-xl transition-all duration-300 sm:p-4 lg:hidden dark:border-teal-200"
            : "sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-teal-900/10 bg-white/85 p-3 shadow-sm backdrop-blur-xl transition-all duration-300 dark:bg-background/80 sm:p-4 lg:hidden"}>
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button aria-label="Buka menu" variant="ghost" size="icon" className={type === "admin"
                            ? "-ml-2 h-11 w-11 shrink-0 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/40 lg:hidden"
                            : "-ml-2 h-11 w-11 shrink-0 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/40 lg:hidden"}>
                            <Menu className={type === "admin" ? "h-6 w-6 text-teal-950 dark:text-teal-100" : "h-6 w-6 text-teal-950 dark:text-teal-100"} />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="h-dvh w-[min(84vw,280px)] overflow-hidden overscroll-contain border-none bg-[#062f2d] p-0 text-white shadow-xl">
                        <SheetTitle className="sr-only">Navigasi Menu</SheetTitle>
                        <SheetDescription className="sr-only">Menu Navigasi Utama</SheetDescription>
                        {type === "admin" ? (
                            <Sidebar compact onNavigate={() => setOpen(false)} />
                        ) : (
                            <InvestorSidebar onNavigate={() => setOpen(false)} />
                        )}
                    </SheetContent>
                </Sheet>
                <BrandMark compact className="sm:hidden" />
                <BrandMark className="hidden sm:flex" />
            </div>

            <div className="flex items-center gap-2">
                <ThemeSwitcher />
                <div className="hidden sm:flex flex-col items-end mr-1">
                    <span className="text-sm font-medium leading-none">{session?.user?.name || "User"}</span>
                    <span className="text-xs text-muted-foreground capitalize">{(session?.user as any)?.role?.toLowerCase() || "Viewer"}</span>
                </div>
                <Avatar className={type === "admin" ? "h-9 w-9 border border-teal-100 shadow-sm dark:border-teal-950/50" : "h-9 w-9 border border-teal-100 shadow-sm dark:border-teal-950/50"}>
                    <AvatarImage src={session?.user?.image || ""} />
                    <AvatarFallback className={type === "admin" ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"}>
                        {getInitials(session?.user?.name)}
                    </AvatarFallback>
                </Avatar>
            </div>
        </div>
    )
}
