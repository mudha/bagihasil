"use client"

import { Menu, UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Sidebar } from "./Sidebar"
import { InvestorSidebar } from "./InvestorSidebar"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
        <div className="flex items-center justify-between p-4 md:hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b sticky top-0 z-50 shadow-sm transition-all duration-300">
            <div className="flex items-center gap-3">
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden hover:bg-transparent -ml-2">
                            <Menu className="h-6 w-6 text-gray-700 dark:text-gray-200" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-[280px] border-none bg-background shadow-xl">
                        <SheetTitle className="sr-only">Navigasi Menu</SheetTitle>
                        <SheetDescription className="sr-only">Menu Navigasi Utama</SheetDescription>
                        {type === "admin" ? (
                            <Sidebar onNavigate={() => setOpen(false)} />
                        ) : (
                            <InvestorSidebar onNavigate={() => setOpen(false)} />
                        )}
                    </SheetContent>
                </Sheet>
                <div className="flex flex-col">
                    <span className={`font-bold text-lg leading-none ${type === "admin" ? "text-blue-600" : "text-emerald-600"}`}>
                        {type === "admin" ? "Profit Share" : "Investor Portal"}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        {type === "admin" ? "Administrator" : "Dashboard"}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col items-end mr-1">
                    <span className="text-sm font-medium leading-none">{session?.user?.name || "User"}</span>
                    <span className="text-xs text-muted-foreground capitalize">{session?.user?.role?.toLowerCase() || "Viewer"}</span>
                </div>
                <Avatar className="h-8 w-8 border border-gray-200 shadow-sm">
                    <AvatarImage src={session?.user?.image || ""} />
                    <AvatarFallback className={type === "admin" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}>
                        {getInitials(session?.user?.name)}
                    </AvatarFallback>
                </Avatar>
            </div>
        </div>
    )
}
