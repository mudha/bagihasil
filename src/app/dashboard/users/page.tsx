"use client"

import { useEffect, useState } from "react"
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
    email: z.string().email("Email tidak valid"),
    password: z.string().optional().or(z.literal("")),
    role: z.enum(["ADMIN", "INVESTOR", "VIEWER"]),
}).refine((data) => {
    // If it's a new user (usually we'd check if we are in edit mode, but schema doesn't know context)
    // We'll handle context-based validation in the component logic or by providing default blank for edit.
    return true
}, {
    message: "Password minimal 6 karakter",
    path: ["password"],
})

type UserFormValues = z.infer<typeof userSchema>

interface User {
    id: string
    name: string
    email: string
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

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            name: "",
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
                email: editingUser.email,
                password: "", // Leave blank unless changing
                role: editingUser.role,
            })
        } else {
            form.reset({
                name: "",
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
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
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

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama</TableHead>
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
                                <TableCell>{user.email}</TableCell>
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
