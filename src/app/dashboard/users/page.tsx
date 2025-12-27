"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Plus, Shield, User as UserIcon, Wallet, Pencil, Trash2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
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
    createdAt: string
    investor?: {
        name: string
    }
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const { data: session, status: sessionStatus } = useSession()

    // @ts-ignore
    const isAdmin = session?.user?.role === "ADMIN"

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            name: "",
            username: "",
            email: "",
            password: "",
            role: "VIEWER",
        },
    })

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users')
            if (res.ok) {
                const data = await res.json()
                setUsers(data)
            }
        } catch (error) {
            console.error("Failed to fetch users")
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    useEffect(() => {
        if (editingUser) {
            form.reset({
                name: editingUser.name,
                username: editingUser.username || "",
                email: editingUser.email || "",
                password: "", // Leave blank unless changing
                role: editingUser.role,
            })
        } else {
            form.reset({
                name: "",
                username: "",
                email: "",
                password: "",
                role: "VIEWER",
            })
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

            const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
            const method = editingUser ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            })

            if (res.ok) {
                toast.success(editingUser ? "User berhasil diupdate" : "User berhasil ditambahkan")
                setIsOpen(false)
                setEditingUser(null)
                form.reset()
                fetchUsers()
            } else {
                const errorData = await res.json()
                toast.error(errorData.error || "Gagal menyimpan user")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan sistem")
        }
    }

    const handleDelete = async () => {
        if (!deleteId) return
        try {
            const res = await fetch(`/api/users/${deleteId}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                toast.success("User berhasil dihapus")
                fetchUsers()
            } else {
                const errorData = await res.json()
                toast.error(errorData.error || "Gagal menghapus user")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setDeleteId(null)
        }
    }

    const getRoleBadge = (role: string) => {
        switch (role) {
            case "ADMIN":
                return <Badge variant="destructive"><Shield className="w-3 h-3 mr-1" /> Admin</Badge>
            case "INVESTOR":
                return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600"><Wallet className="w-3 h-3 mr-1" /> Investor</Badge>
            default:
                return <Badge variant="secondary"><UserIcon className="w-3 h-3 mr-1" /> Viewer</Badge>
        }
    }

    const handleEditClick = (user: User) => {
        setEditingUser(user)
        setIsOpen(true)
    }

    const handleCloseDialog = (open: boolean) => {
        setIsOpen(open)
        if (!open) {
            setEditingUser(null)
            form.reset()
        }
    }

    if (sessionStatus === "loading") {
        return <div className="p-8 text-center">Memuat...</div>
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <Shield className="w-16 h-16 text-destructive" />
                <h2 className="text-2xl font-bold">Akses Ditolak</h2>
                <p className="text-muted-foreground">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
                <Button onClick={() => window.location.href = "/dashboard"}>Kembali ke Dashboard</Button>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Kelola User</h2>
                    <p className="text-muted-foreground">Tambah dan atur hak akses pengguna aplikasi.</p>
                </div>
                <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Tambah User
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingUser ? "Edit User" : "Tambah User Baru"}</DialogTitle>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nama Lengkap</FormLabel>
                                            <FormControl>
                                                <Input placeholder="John Doe" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Username</FormLabel>
                                            <FormControl>
                                                <Input placeholder="johndoe" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email (Opsional)</FormLabel>
                                            <FormControl>
                                                <Input type="email" placeholder="john@example.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Password {editingUser && "(Kosongkan jika tidak ingin ganti)"}</FormLabel>
                                            <FormControl>
                                                <Input type="password" placeholder="******" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="role"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Hak Akses (Role)</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Pilih Role" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="VIEWER">Viewer (Lihat Saja)</SelectItem>
                                                    <SelectItem value="INVESTOR">Investor</SelectItem>
                                                    <SelectItem value="ADMIN">Admin (Akses Penuh)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full">
                                    {editingUser ? "Update User" : "Simpan User"}
                                </Button>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {users.length === 0 ? (
                    <div className="text-center p-8 border rounded-md text-muted-foreground bg-slate-50">
                        Belum ada data user.
                    </div>
                ) : (
                    users.map((user) => (
                        <div key={user.id} className="border rounded-lg p-4 space-y-3 bg-white dark:bg-slate-950 shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-semibold text-base">{user.name}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="font-mono text-xs text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">{user.username || "-"}</span>
                                        {getRoleBadge(user.role)}
                                    </div>
                                </div>
                            </div>

                            <div className="text-sm border-t pt-3 mt-2 grid grid-cols-1 gap-2">
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-0.5">Email</span>
                                    <span className="font-medium text-foreground">{user.email || "-"}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-0.5">Terhubung ke Investor</span>
                                    {user.investor ? (
                                        <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded text-xs">{user.investor.name}</span>
                                    ) : (
                                        <span className="text-muted-foreground italic text-xs text-slate-400">-</span>
                                    )}
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground mb-0.5">Dibuat Pada</span>
                                    <span className="text-muted-foreground">{new Date(user.createdAt).toLocaleDateString('id-ID')}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t pt-3 mt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleEditClick(user)}
                                >
                                    <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                    onClick={() => setDeleteId(user.id)}
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Hapus
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>Username</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Terhubung ke...</TableHead>
                            <TableHead>Tanggal Dibuat</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.name}</TableCell>
                                <TableCell className="font-mono text-sm">{user.username || "-"}</TableCell>
                                <TableCell>{user.email || "-"}</TableCell>
                                <TableCell>{getRoleBadge(user.role)}</TableCell>
                                <TableCell>
                                    {user.investor ? (
                                        <span className="text-emerald-600 font-medium">Pemodal: {user.investor.name}</span>
                                    ) : (
                                        <span className="text-muted-foreground italic text-xs">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {new Date(user.createdAt).toLocaleDateString('id-ID')}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEditClick(user)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-600"
                                            onClick={() => setDeleteId(user.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {users.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                    Belum ada data user.
                                </TableCell>
                            </TableRow>
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
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
