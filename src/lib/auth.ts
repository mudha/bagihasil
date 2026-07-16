import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { authConfig } from "./auth.config"
import { getLoginCity } from "./login-location"

const loginSchema = z.object({
    identifier: z.string().min(1),
    password: z.string().min(6),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    providers: [
        Credentials({
            name: "Credentials",
            credentials: {
                identifier: { label: "Username / Email", type: "text" },
                password: { label: "Password", type: "password" }
            },
            authorize: async (credentials, request) => {
                const parsedCredentials = loginSchema.safeParse(credentials)

                if (!parsedCredentials.success) {
                    return null
                }

                const { identifier, password } = parsedCredentials.data

                // Try to find user by username or email
                const user = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { username: identifier },
                            { email: identifier }
                        ]
                    }
                })

                if (!user || !user.passwordHash) return null

                const isValid = await bcrypt.compare(password, user.passwordHash)

                if (!isValid) return null

                try {
                    return await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            lastLoginAt: new Date(),
                            lastLoginCity: getLoginCity(request),
                        }
                    })
                } catch (error) {
                    // Login tetap diizinkan jika pencatatan metadata gagal.
                    console.error("Failed to record last login:", error)
                    return user
                }
            }
        })
    ],
    session: {
        strategy: "jwt"
    },
})
