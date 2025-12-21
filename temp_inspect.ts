
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const id = 'cmiuhysd9009u428wljp5qe4c'
    const transaction = await prisma.transaction.findUnique({
        where: { id },
        include: {
            profitSharing: true,
            unit: true
        }
    })
    console.log(JSON.stringify(transaction, null, 2))
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
