import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function main() {
    console.log('--- Memulai Ekspor Data dari SQLite ---')

    const data = {
        users: await prisma.user.findMany(),
        investors: await prisma.investor.findMany(),
        units: await prisma.unit.findMany(),
        transactions: await prisma.transaction.findMany(),
        transactionProofs: await prisma.transactionProof.findMany(),
        costs: await prisma.cost.findMany(),
        costProofs: await prisma.costProof.findMany(),
        profitSharings: await prisma.profitSharing.findMany(),
        paymentHistories: await prisma.paymentHistory.findMany(),
    }

    fs.writeFileSync('data-export.json', JSON.stringify(data, null, 2))
    console.log('✅ Berhasil mengekspor data ke data-export.json')
    console.log(`Summary:
  - Users: ${data.users.length}
  - Investors: ${data.investors.length}
  - Units: ${data.units.length}
  - Transactions: ${data.transactions.length}
  - Costs: ${data.costs.length}
  `)
}

main()
    .catch((e) => {
        console.error('❌ Error saat ekspor:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
