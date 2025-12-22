import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const { nextUrl } = req

    // @ts-ignore
    const role = req.auth?.user?.role

    const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth")
    const isPublicRoute = nextUrl.pathname === "/login"
    const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard")

    if (isApiAuthRoute) {
        return undefined // null? in middleware returning undefined/void lets it pass
    }

    if (isPublicRoute) {
        if (isLoggedIn) {
            if (role === "INVESTOR") {
                return NextResponse.redirect(new URL("/dashboard/investor", nextUrl))
            }
            return NextResponse.redirect(new URL("/dashboard", nextUrl))
        }
        return undefined
    }

    if (!isLoggedIn && isDashboardRoute) {
        return NextResponse.redirect(new URL("/login", nextUrl))
    }

    if (isLoggedIn && isDashboardRoute) {
        // Check if route is exactly /dashboard/investor or a sub-route of it
        // This prevents matching /dashboard/investors (plural) which is an admin route
        const isInvestorRoute = nextUrl.pathname === "/dashboard/investor" || nextUrl.pathname.startsWith("/dashboard/investor/")

        // Investor trying to access non-investor dashboard pages
        if (role === "INVESTOR" && !isInvestorRoute) {
            return NextResponse.redirect(new URL("/dashboard/investor", nextUrl))
        }

        // Non-investor (Admin/Viewer) trying to access investor pages?
        // Maybe let them? Or restrict? Let's restrict to keep it clean.
        if (role !== "INVESTOR" && isInvestorRoute) {
            // Redirect Admin back to main dashboard
            return NextResponse.redirect(new URL("/dashboard", nextUrl))
        }
    }

    return undefined
})

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
