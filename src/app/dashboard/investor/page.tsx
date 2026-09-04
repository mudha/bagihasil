"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { InvestorTabs } from "./InvestorTabs"
import { ErrorState } from "@/components/mudha/ErrorState"

export default function InvestorDashboardPage() {
    const router = useRouter()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isAccessDenied, setIsAccessDenied] = useState(false)
    const [isNotFound, setIsNotFound] = useState(false)
    const [monthsRange, setMonthsRange] = useState<string>("6")
    const [retryNonce, setRetryNonce] = useState(0)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        setIsAccessDenied(false)
        setIsNotFound(false)
        setData(null)
        try {
            const res = await fetch(`/api/investor/dashboard?months=${monthsRange}`)
            if (res.status === 401) {
                router.push("/login")
                return
            }
            if (res.status === 403) {
                setIsAccessDenied(true)
                setError("Akses tidak tersedia")
                return
            }
            if (res.status === 404) {
                setIsNotFound(true)
                return
            }
            if (!res.ok) {
                throw new Error("fetch failed")
            }
            const result: unknown = await res.json()
            if (
                !result ||
                typeof result !== "object" ||
                !("investor" in result) ||
                !("stats" in result) ||
                !("investmentsData" in result) ||
                !("paymentsData" in result) ||
                !Array.isArray(result.investmentsData) ||
                !Array.isArray(result.paymentsData)
            ) {
                throw new Error("invalid response")
            }
            setData(result)
        } catch {
            setError("Ringkasan modal belum dapat dimuat. Silakan coba lagi.")
        } finally {
            setLoading(false)
        }
    }, [monthsRange, router])

    useEffect(() => {
        fetchData()
    }, [fetchData, retryNonce])

    if (loading) {
        return (
            <div className="space-y-5 pb-20">
                <div className="h-64 animate-pulse rounded-lg bg-muted" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {[1, 2, 3, 4, 5].map((item) => (
                        <div key={item} className="h-32 animate-pulse rounded-lg bg-muted" />
                    ))}
                </div>
            </div>
        )
    }

    if (isAccessDenied) {
        return (
            <div className="space-y-4 pb-20">
                <ErrorState
                    title="Akses tidak tersedia"
                    description={error ?? undefined}
                />
            </div>
        )
    }

    if (isNotFound) {
        return (
            <div className="space-y-4 pb-20">
                <ErrorState
                    title="Akun Investor Tidak Ditemukan"
                    description="Akun Anda terdaftar sebagai User, namun belum dihubungkan ke data Investor oleh Admin."
                />
            </div>
        )
    }

    if (error) {
        return (
            <div className="space-y-4 pb-20">
                <ErrorState
                    title="Gagal memuat data pemodal"
                    description={error}
                    onRetry={() => setRetryNonce((n) => n + 1)}
                />
            </div>
        )
    }

    if (!data) {
        return (
            <div className="space-y-4 pb-20">
                <ErrorState
                    title="Akun Investor Tidak Ditemukan"
                    description="Akun Anda terdaftar sebagai User, namun belum dihubungkan ke data Investor oleh Admin."
                />
            </div>
        )
    }

    return (
        <InvestorTabs
            investorName={data.investor.name}
            stats={data.stats}
            monthlyChartData={data.monthlyChartData}
            monthlySalesTrend={data.monthlySalesTrend}
            monthlyRevenueData={data.monthlyRevenueData}
            monthlyChartDataHijri={data.monthlyChartDataHijri}
            monthlySalesTrendHijri={data.monthlySalesTrendHijri}
            monthlyRevenueDataHijri={data.monthlyRevenueDataHijri}
            investmentsData={data.investmentsData}
            paymentsData={data.paymentsData}
            monthsRange={monthsRange}
            onMonthsRangeChange={setMonthsRange}
        />
    )
}
