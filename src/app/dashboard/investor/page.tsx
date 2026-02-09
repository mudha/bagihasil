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
        return <div className="p-8">Memuat data...</div>
    }

    if (!data) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-bold text-red-500">Akun Investor Tidak Ditemukan</h1>
                <p>Akun Anda terdaftar sebagai User, namun belum dihubungkan ke data Investor oleh Admin.</p>
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
