"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { InvestorTabs } from "./InvestorTabs"

export default function InvestorDashboardPage() {
    const router = useRouter()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [monthsRange, setMonthsRange] = useState<string>("6")

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/investor/dashboard?months=${monthsRange}`)
                if (res.status === 401) {
                    router.push('/login')
                    return
                }
                if (!res.ok) {
                    throw new Error('Failed to fetch investor data')
                }
                const result = await res.json()
                setData(result)
            } catch (err) {
                console.error("Error fetching investor data:", err)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [monthsRange, router])

    if (loading) {
        return (
            <div className="space-y-5 pb-20">
                <div className="h-64 animate-pulse rounded-lg bg-teal-900/10" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {[1, 2, 3, 4, 5].map((item) => (
                        <div key={item} className="h-32 animate-pulse rounded-lg bg-slate-100" />
                    ))}
                </div>
            </div>
        )
    }

    if (!data) {
        return (
            <div className="rounded-lg border border-red-100 bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-black text-red-600">Akun Investor Tidak Ditemukan</h1>
                <p className="mt-2 leading-relaxed text-slate-600">Akun Anda terdaftar sebagai User, namun belum dihubungkan ke data Investor oleh Admin.</p>
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
