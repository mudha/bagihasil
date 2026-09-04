import { LoginForm } from "@/components/auth/LoginForm"
import { BrandMark } from "@/components/layout/BrandMark"
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher"

export default function LoginPage() {
    return (
        <div className="relative flex min-h-dvh w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top_left,#ccfbf1_0%,#f8fafc_38%,#ffffff_100%)] px-4 dark:bg-[radial-gradient(circle_at_top_left,rgba(6,47,45,0.3)_0%,rgba(16,33,31,0.8)_38%,#0B1514_100%)]">
            <div className="absolute -right-24 top-16 size-64 rounded-full bg-teal-200/30 blur-3xl dark:bg-teal-800/15" />
            <div className="absolute -left-20 bottom-10 size-56 rounded-full bg-lime-200/35 blur-3xl dark:bg-lime-800/10" />
            <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
                <ThemeSwitcher />
            </div>
            <div className="relative mb-8 rounded-lg border border-white/70 bg-white/70 px-5 py-4 shadow-xl shadow-teal-900/5 backdrop-blur dark:border-white/10 dark:bg-card/60">
                <BrandMark />
            </div>
            <LoginForm />
            <p className="relative mt-8 text-sm text-muted-foreground">
                &copy; 2026 Mudha Profit Studio
            </p>
        </div>
    )
}
