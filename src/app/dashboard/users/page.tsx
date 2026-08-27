"use client"
import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Plus, Shield, User as UserIcon, Wallet, Pencil, Trash2 } from "lucide-react"
import { OperationalPageHeader } from "@/components/mudha/OperationalPageHeader"
import { LoadingState } from "@/components/mudha/LoadingState"
import { ErrorState } from "@/components/mudha/ErrorState"
import { EmptyState } from "@/components/mudha/EmptyState"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const userSchema = z.object({
    name: z.string().min(1, "Nama wajib diisi"),
    username: z.string().min(3, "Username minimal 3 karakter"),
    email: z.string().email("Email tidak valid").optional().or(z.literal("")),
    password: z.string().optional().or(z.literal("")),
    role: z.enum(["ADMIN", "INVESTOR", "VIEWER"]),
})

type UserFormValues = z.infer<typeof userSchema>

interface User {
    id: string
    name: string
    username: string | null
    email: string | null
    role: "ADMIN" | "INVESTOR" | "VIEWER"
    lastLoginAt: string | null
    lastLoginCity: string | null
    createdAt: string
    investor?: { name: string }
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isAccessDenied, setIsAccessDenied] = useState(false)
    const [retryNonce, setRetryNonce] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const { data: session, status: sessionStatus } = useSession()
    const isAdmin = session?.user?.role === "ADMIN"

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: { name: "", username: "", email: "", password: "", role: "VIEWER" },
    })

    const fetchUsers = useCallback(async () => {
        setUsers([])
        setError(null)
        setIsAccessDenied(false)
        setIsLoading(true)
        try {
            const res = await fetch("/api/users")
            if (res.status === 401 || res.status === 403) {
                setIsAccessDenied(true)
                setError("Akses tidak tersedia")
                return
            }
            if (!res.ok) {
                throw new Error("Gagal memuat data user")
            }
            const data = await res.json()
            if (!Array.isArray(data)) {
                throw new Error("Gagal memuat data user")
            }
            setUsers(data)
        } catch {
            setError("Gagal memuat data user. Silakan coba lagi.")
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (sessionStatus === "authenticated" && isAdmin) {
            fetchUsers()
        }
    }, [fetchUsers, sessionStatus, isAdmin, retryNonce])

    useEffect(() => {
        if (editingUser) {
            form.reset({
                name: editingUser.name,
                username: editingUser.username || "",
                email: editingUser.email || "",
                password: "",
                role: editingUser.role,
            })
        } else {
            form.reset({ name: "", username: "", email: "", password: "", role: "VIEWER" })
        }
    }, [editingUser, form])

    async function onSubmit(values: UserFormValues) {
        try {
            if (!editingUser && (!values.password || values.password.length < 6)) {
                toast.error("Password minimal 6 karakter untuk user baru")
                return
            }
            if (editingUser && values.password && values.password.length < 6) {
                toast.error("Password minimal 6 karakter jika ingin mengganti")
                return
            }
            const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users"
            const method = editingUser ? "PUT" : "POST"
            const res = await fetch(url, {
                method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
            })
            if (res.ok) {
                toast.success(editingUser ? "User berhasil diupdate" : "User berhasil ditambahkan")
                setIsOpen(false); setEditingUser(null); form.reset(); fetchUsers()
            } else {
                const errorData = await res.json()
                toast.error(errorData.error || "Gagal menyimpan user")
            }
        } catch {
            toast.error("Terjadi kesalahan sistem")
        }
    }

    const handleDelete = async () => {
        if (!deleteId) return
        try {
            const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" })
            if (res.ok) {
                toast.success("User berhasil dihapus"); fetchUsers()
            } else {
                const errorData = await res.json()
                toast.error(errorData.error || "Gagal menghapus user")
            }
        } catch {
            toast.error("Terjadi kesalahan sistem")
        } finally { setDeleteId(null) }
    }

    const getRoleBadge = (role: string) => {
        switch (role) {
            case "ADMIN": return <Badge variant="destructive"><Shield className="w-3 h-3 mr-1" /> Admin</Badge>
            case "INVESTOR": return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600"><Wallet className="w-3 h-3 mr-1" /> Investor</Badge>
            default: return <Badge variant="secondary"><UserIcon className="w-3 h-3 mr-1" /> Viewer</Badge>
        }
    }

    const formatLastLogin = (lastLoginAt: string | null) => {
        if (!lastLoginAt) return null
        return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(lastLoginAt))
    }

    const handleEditClick = (user: User) => { setEditingUser(user); setIsOpen(true) }
    const handleCloseDialog = (open: boolean) => { setIsOpen(open); if (!open) { setEditingUser(null); form.reset() } }

    const userDialog = (
        <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Tambah User</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>{editingUser ? "Edit User" : "Tambah User Baru"}</DialogTitle></DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Nama Lengkap</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="username" render={({ field }) => (
                            <FormItem><FormLabel>Username</FormLabel><FormControl><Input placeholder="johndoe" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem><FormLabel>Email (Opsional)</FormLabel><FormControl><Input type="email" placeholder="john@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="password" render={({ field }) => (
                            <FormItem><FormLabel>Password {editingUser && "(Kosongkan jika tidak ingin ganti)"}</FormLabel><FormControl><Input type="password" placeholder="******" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="role" render={({ field }) => (
                            <FormItem><FormLabel>Hak Akses (Role)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih Role" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="VIEWER">Viewer (Lihat Saja)</SelectItem>
                                        <SelectItem value="INVESTOR">Investor</SelectItem>
                                        <SelectItem value="ADMIN">Admin (Akses Penuh)</SelectItem>
                                    </SelectContent>
                                </Select><FormMessage /></FormItem>
                        )} />
                        <Button type="submit" className="w-full">{editingUser ? "Update User" : "Simpan User"}</Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )

    // ── view-state branches ──

    if (sessionStatus === "loading") {
        return (
            <div className="space-y-4">
                <OperationalPageHeader title="Kelola User" description="Tambah dan atur hak akses pengguna aplikasi." />
                <LoadingState variant="table" label="Memuat sesi…" />
            </div>
        )
    }

    if (!isAdmin) {
        return (
            <div className="space-y-4">
                <OperationalPageHeader title="Kelola User" description="Tambah dan atur hak akses pengguna aplikasi." />
                <ErrorState
                    title="Akses Ditolak"
                    description="Anda tidak memiliki izin untuk mengakses halaman ini."
                    icon={<Shield className="h-6 w-6" />}
                />
                <Button onClick={() => window.location.href = "/dashboard"}>Kembali ke Dashboard</Button>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <OperationalPageHeader
                    title="Kelola User"
                    description="Tambah dan atur hak akses pengguna aplikasi."
                    primaryAction={userDialog}
                />
                <LoadingState variant="table" label="Memuat data user…" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="space-y-4">
                <OperationalPageHeader
                    title="Kelola User"
                    description="Tambah dan atur hak akses pengguna aplikasi."
                    primaryAction={userDialog}
                />
                <ErrorState
                    title={isAccessDenied ? "Akses tidak tersedia" : "Gagal memuat data user"}
                    description={isAccessDenied ? undefined : error}
                    onRetry={isAccessDenied ? undefined : () => setRetryNonce((n) => n + 1)}
                />
            </div>
        )
    }

    // ── loaded with data ──

    return (
        <div className="space-y-8">
            <OperationalPageHeader
                title="Kelola User"
                description="Tambah dan atur hak akses pengguna aplikasi."
                primaryAction={userDialog}
            />

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 lg:hidden">
                {users.length === 0 ? (
                    <EmptyState title="Belum ada data user" description="User baru akan muncul di sini setelah ditambahkan." />
                ) : (
                    users.map((user) => (
                        <div key={user.id} className="rounded-lg border border-[var(--mudha-border-default)] bg-[var(--mudha-surface-primary)] p-4 shadow-[var(--mudha-shadow-xs)] space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-semibold text-base">{user.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="font-mono text-xs text-[var(--mudha-text-muted)] bg-[var(--mudha-surface-subtle)] px-1.5 py-0.5 rounded">{user.username || "-"}</span>
                                        {getRoleBadge(user.role)}
                                    </div>
                                </div>
                            </div>
                            <div className="text-sm border-t border-[var(--mudha-border-subtle)] pt-3 mt-2 grid grid-cols-1 gap-2">
                                <div>
                                    <span className="block text-xs text-[var(--mudha-text-muted)] mb-0.5">Email</span>
                                    <span className="font-medium text-[var(--mudha-text)]">{user.email || "-"}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-[var(--mudha-text-muted)] mb-0.5">Terhubung ke Investor</span>
                                    {user.investor ? (
                                        <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded text-xs">{user.investor.name}</span>
                                    ) : (
                                        <span className="text-[var(--mudha-text-muted)] italic text-xs">-</span>
                                    )}
                                </div>
                                <div>
                                    <span className="block text-xs text-[var(--mudha-text-muted)] mb-0.5">Login Terakhir</span>
                                    {user.lastLoginAt ? (
                                        <div className="space-y-0.5">
                                            <span className="block font-medium text-[var(--mudha-text)]">{formatLastLogin(user.lastLoginAt)} WIB</span>
                                            <span className="block text-xs text-[var(--mudha-text-muted)]">{user.lastLoginCity ? `${user.lastLoginCity} · perkiraan IP` : "Lokasi tidak diketahui"}</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs italic text-[var(--mudha-text-muted)]">Belum pernah tercatat</span>
                                    )}
                                </div>
                                <div>
                                    <span className="block text-xs text-[var(--mudha-text-muted)] mb-0.5">Dibuat Pada</span>
                                    <span className="text-[var(--mudha-text-muted)]">{new Date(user.createdAt).toLocaleDateString("id-ID")}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 border-t border-[var(--mudha-border-subtle)] pt-3 mt-2">
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditClick(user)}>
                                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => setDeleteId(user.id)}>
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Hapus
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden rounded-md border border-[var(--mudha-border-default)] lg:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>Username</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Terhubung ke...</TableHead>
                            <TableHead>Login Terakhir</TableHead>
                            <TableHead>Tanggal Dibuat</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-4 text-[var(--mudha-text-muted)]">
                                    Belum ada data user.
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.name}</TableCell>
                                    <TableCell className="font-mono text-sm">{user.username || "-"}</TableCell>
                                    <TableCell>{user.email || "-"}</TableCell>
                                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                                    <TableCell>
                                        {user.investor ? (
                                            <span className="text-emerald-600 font-medium">Pemodal: {user.investor.name}</span>
                                        ) : (
                                            <span className="text-[var(--mudha-text-muted)] italic text-xs">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {user.lastLoginAt ? (
                                            <div className="space-y-0.5">
                                                <div className="whitespace-nowrap text-sm font-medium">{formatLastLogin(user.lastLoginAt)} WIB</div>
                                                <div className="whitespace-nowrap text-xs text-[var(--mudha-text-muted)]">{user.lastLoginCity ? `${user.lastLoginCity} · perkiraan IP` : "Lokasi tidak diketahui"}</div>
                                            </div>
                                        ) : (
                                            <span className="whitespace-nowrap text-xs italic text-[var(--mudha-text-muted)]">Belum pernah tercatat</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs text-[var(--mudha-text-muted)]">{new Date(user.createdAt).toLocaleDateString("id-ID")}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(user)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => setDeleteId(user.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Menghapus user akan menghilangkan akses login mereka ke aplikasi.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}