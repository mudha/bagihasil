import { LoginForm } from "@/components/auth/LoginForm"
import { CirclePercent } from "lucide-react"

export default function LoginPage() {
    return (
        <div className="flex flex-col h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <div className="flex items-center gap-3 mb-8">
                <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none">
                    <CirclePercent className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                    Mudha
                </h1>
            </div>
            <LoginForm />
            <p className="mt-8 text-sm text-muted-foreground">
                &copy; 2025 Mudha Profit Share
            </p>
        </div>
    )
}
