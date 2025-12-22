import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export default async function InvestorProfilePage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    // Get Investor
    const investor = await db.investor.findUnique({
        where: { userId: session.user.id }
    })

    if (!investor) return <div>Data Investor tidak ditemukan</div>

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Profil Saya</h2>
            <Card>
                <CardHeader>
                    <CardTitle>Informasi Akun</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Nama Lengkap</Label>
                        <Input value={investor.name} disabled readOnly />
                    </div>
                    <div className="grid gap-2">
                        <Label>Email Login</Label>
                        <Input value={session.user.email || "-"} disabled readOnly />
                    </div>
                    <div className="grid gap-2">
                        <Label>Kontak / No HP</Label>
                        <Input value={investor.contactInfo || "-"} disabled readOnly />
                    </div>
                    <div className="grid gap-2">
                        <Label>Detail Rekening Bank (Untuk Transfer Bagi Hasil)</Label>
                        <Input value={investor.bankAccountDetails || "-"} disabled readOnly />
                        <p className="text-xs text-muted-foreground">Hubungi Admin jika ingin mengubah data rekening.</p>
                    </div>
                    <div className="grid gap-2">
                        <Label>Persentase Bagi Hasil (Investor)</Label>
                        <Input value={`${investor.marginPercentage}%`} disabled readOnly />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
