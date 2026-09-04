"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

const formSchema = z.object({
    identifier: z.string().min(1, "Username atau email wajib diisi"),
    password: z.string().min(6, "Password minimal 6 karakter"),
})

export function LoginForm() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            identifier: "",
            password: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
            const result = await signIn("credentials", {
                identifier: values.identifier,
                password: values.password,
                redirect: false,
            })

            if (result?.error) {
                toast.error("Username/email atau password salah")
            } else {
                toast.success("Login berhasil")
                router.push("/dashboard")
                router.refresh()
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Card className="relative w-full max-w-[380px] overflow-hidden rounded-lg border-white/80 bg-white/85 dark:border-white/10 dark:bg-card/80 shadow-2xl shadow-teal-900/10 backdrop-blur">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />
            <CardHeader>
                <CardTitle className="text-2xl">Selamat datang</CardTitle>
                <CardDescription>Masuk untuk memantau modal, unit, dan bagi hasil.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="identifier"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Username / Email</FormLabel>
                                    <FormControl>
                                        <Input className="h-11 rounded-lg border-border bg-background" placeholder="username atau email" {...field} />
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
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <Input className="h-11 rounded-lg border-border bg-background" type="password" placeholder="******" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="h-11 w-full rounded-lg bg-teal-600 shadow-lg shadow-teal-600/20 hover:bg-teal-700" disabled={isLoading}>
                            {isLoading ? "Memproses..." : "Login"}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
