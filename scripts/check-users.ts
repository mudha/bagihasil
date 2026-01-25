import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    console.log("Checking users...")
    const users = await prisma.user.findMany({
        select: {
            id: true,
            username: true,
            email: true,
            role: true,
            // Don't log full password hash for security, just check presence
            passwordHash: true
        }
    })

    if (users.length === 0) {
        console.log("No users found in database!")
    } else {
        console.log(`Found ${users.length} users:`)
        users.forEach(u => {
            console.log(`- ${u.username} (${u.email}) [Role: ${u.role}] [HasPwd: ${!!u.passwordHash}]`)
        })
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
