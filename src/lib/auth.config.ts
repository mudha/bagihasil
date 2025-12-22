import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role
                token.id = user.id
            }
            return token
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub
            }
            if (session.user && token.role) {
                // @ts-ignore
                session.user.role = token.role
            }
            return session
        }
    },
    providers: [], // Empty for now, will be filled in auth.ts
} satisfies NextAuthConfig
