import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'admin@example.com' }
    })

    if (!user) {
        console.log("User admin@example.com not found")
        return
    }

    const isValid = await bcrypt.compare('password123', user.passwordHash || '')
    console.log("Password 'password123' for admin@example.com is valid:", isValid)
    console.log("User details:", JSON.stringify({ email: user.email, name: user.name, role: user.role }, null, 2))
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())

