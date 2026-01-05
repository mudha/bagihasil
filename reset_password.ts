import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const password = 'password123'
    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.user.update({
        where: { email: 'admin@example.com' },
        data: {
            passwordHash: hashedPassword
        }
    })

    console.log("Password for admin@example.com has been reset to 'password123'")
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
