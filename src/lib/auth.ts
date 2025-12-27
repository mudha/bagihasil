import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { authConfig } from "./auth.config"

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
            authorize: async (credentials) => {
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

                return user
            }
        })
    ],
    session: {
        strategy: "jwt"
    },
})
