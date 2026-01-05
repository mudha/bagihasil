"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InvestmentsTable } from "@/components/investor/InvestmentsTable"
import { PaymentsTable } from "@/components/investor/PaymentsTable"

interface InvestorTabsProps {
    investmentsData: any[]
    paymentsData: any[]
    dashboardContent: React.ReactNode
}

export function InvestorTabs({ investmentsData, paymentsData, dashboardContent }: InvestorTabsProps) {
    return (
        <Tabs defaultValue="dashboard" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="investments">Investasi</TabsTrigger>
                <TabsTrigger value="payments">Pembayaran</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4">
                {dashboardContent}
            </TabsContent>

            <TabsContent value="investments" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Unit Didanai</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <InvestmentsTable data={investmentsData} />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Riwayat Pembayaran</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <PaymentsTable data={paymentsData} />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    )
}
