import { LoginForm } from "@/components/auth/LoginForm"
import { BrandMark } from "@/components/layout/BrandMark"

export default function LoginPage() {
    return (
        <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,#ccfbf1_0%,#f8fafc_38%,#ffffff_100%)] px-4 dark:bg-gray-900">
            <div className="absolute -right-24 top-16 size-64 rounded-full bg-teal-200/30 blur-3xl" />
            <div className="absolute -left-20 bottom-10 size-56 rounded-full bg-lime-200/35 blur-3xl" />
            <div className="relative mb-8 rounded-lg border border-white/70 bg-white/70 px-5 py-4 shadow-xl shadow-teal-900/5 backdrop-blur">
                <BrandMark />
            </div>
            <LoginForm />
            <p className="relative mt-8 text-sm text-muted-foreground">
                &copy; 2026 Mudha Profit Studio
            </p>
        </div>
    )
}
