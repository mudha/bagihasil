import { signOut } from "next-auth/react"

export async function signOutToLogin() {
    await signOut({ redirect: false })
    window.location.replace("/login")
}
