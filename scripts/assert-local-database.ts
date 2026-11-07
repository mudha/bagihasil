/**
 * Pengaman `npm run dev`: menolak jalan jika DATABASE_URL/DIRECT_URL bukan database lokal.
 * Tujuannya mencegah aplikasi lokal tanpa sengaja menulis ke database produksi.
 * Override sadar (mis. database dev remote milik sendiri): ALLOW_REMOTE_DEV_DB=true
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "db", "host.docker.internal"])

function check(name: string): string | null {
    const value = process.env[name]
    if (!value) return null
    try {
        const { hostname } = new URL(value)
        return LOCAL_HOSTS.has(hostname.toLowerCase()) ? null : `${name} mengarah ke host non-lokal "${hostname}"`
    } catch {
        return `${name} bukan URL yang valid`
    }
}

if (process.env.ALLOW_REMOTE_DEV_DB === "true") {
    console.warn("[assert-local-database] ALLOW_REMOTE_DEV_DB=true: pengaman dimatikan.")
    process.exit(0)
}

const problems = ["DATABASE_URL", "DIRECT_URL"].map(check).filter((p): p is string => p !== null)

if (problems.length > 0) {
    console.error(`\nBLOCKED: ${problems.join("; ")}.`)
    console.error("`npm run dev` hanya boleh memakai database lokal. Lihat docs/local-development.md.\n")
    process.exit(1)
}
