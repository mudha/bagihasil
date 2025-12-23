"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Sidebar } from "./Sidebar"
import { InvestorSidebar } from "./InvestorSidebar"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"

interface NavbarProps {
    type?: "admin" | "investor"
}

export function Navbar({ type = "admin" }: NavbarProps) {
    const [isMounted, setIsMounted] = useState(false)
    const [open, setOpen] = useState(false)
    const pathname = usePathname()

    useEffect(() => {
        setIsMounted(true)
    }, [])

    useEffect(() => {
        setOpen(false)
    }, [pathname])

    if (!isMounted) {
        return null
    }

    return (
        <div className="flex items-center p-4 md:hidden bg-white dark:bg-gray-900 border-b">
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden">
                        <Menu />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 border-none">
                    <SheetTitle className="sr-only">Navigasi Menu</SheetTitle>
                    <SheetDescription className="sr-only">Pilih menu navigasi untuk pindah halaman dashboard</SheetDescription>
                    {type === "admin" ? <Sidebar /> : <InvestorSidebar />}
                </SheetContent>
            </Sheet>
            <div className="ml-4 font-bold text-lg">
                <span className={type === "admin" ? "text-blue-600" : "text-emerald-600"}>
                    {type === "admin" ? "Profit Share" : "Investor Portal"}
                </span>
            </div>
        </div>
    )
}
