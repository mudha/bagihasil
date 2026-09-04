import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BadgePercent, Landmark, Mail, Phone, User } from "lucide-react"

function ProfileItem({
    label,
    value,
    icon: Icon,
}: {
    label: string
    value: string
    icon: typeof User
}) {
    return (
        <div className="rounded-lg border border-border bg-muted p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                <Icon className="size-4 text-teal-600 dark:text-teal-300" />
                {label}
            </div>
            <p className="text-base font-black leading-relaxed text-foreground [overflow-wrap:anywhere]">{value}</p>
        </div>
    )
}

export interface InvestorProfilePresentation {
    name: string
    email: string
    contactInfo: string
    marginPercentage: string
    bankAccountDetails: string
}

export function InvestorProfileView({ investor }: { investor: InvestorProfilePresentation }) {
    return (
        <div className="space-y-5 pb-20">
            <section className="relative overflow-hidden rounded-lg bg-[#073f3b] p-5 text-white shadow-2xl shadow-teal-950/15 sm:p-8">
                <div className="absolute -right-20 -top-24 size-72 rounded-full bg-cyan-300/20 blur-3xl" />
                <div className="relative">
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-lime-100">Profil investor</p>
                    <h1 className="text-3xl font-black leading-tight [overflow-wrap:anywhere] sm:text-5xl">{investor.name}</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-teal-50/80">
                        Informasi akun, kontak, rekening, dan persentase bagi hasil yang tercatat di sistem.
                    </p>
                </div>
            </section>

            <Card className="rounded-lg border-border bg-card shadow-sm">
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg font-black text-foreground">Informasi Akun</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 p-4 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0">
                    <ProfileItem label="Nama Lengkap" value={investor.name} icon={User} />
                    <ProfileItem label="Email Login" value={investor.email || "-"} icon={Mail} />
                    <ProfileItem label="Kontak / No HP" value={investor.contactInfo || "-"} icon={Phone} />
                    <ProfileItem label="Persentase Bagi Hasil" value={`${investor.marginPercentage}%`} icon={BadgePercent} />
                    <div className="sm:col-span-2">
                        <ProfileItem label="Detail Rekening Bank" value={investor.bankAccountDetails || "-"} icon={Landmark} />
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Hubungi Admin jika ingin mengubah data rekening.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
