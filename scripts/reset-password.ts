import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
    const username = "wahyu"
    const newPassword = "wahyu0848" // Resetting to what the user expects

    console.log(`Resetting password for user: ${username}...`)

    const user = await prisma.user.findFirst({
        where: { username }
    })

    if (!user) {
        console.error(`User '${username}' not found!`)
        return
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash: hashedPassword
        }
    })

    console.log(`Password for '${username}' has been reset to: ${newPassword}`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
