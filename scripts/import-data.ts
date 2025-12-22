import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function main() {
    if (!fs.existsSync('data-export.json')) {
        console.error('❌ File data-export.json tidak ditemukan! Jalankan ekspor dulu.')
        return
    }

    const rawData = fs.readFileSync('data-export.json', 'utf8')
    const data = JSON.parse(rawData)

    console.log('--- Memulai Impor Data ke PostgreSQL (Neon) ---')

    // Helper untuk membersihkan data (contoh: string date ke Date object)
    const fixDates = (obj: any) => {
        const newObj = { ...obj }
        for (const key in newObj) {
            if (typeof newObj[key] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(newObj[key])) {
                newObj[key] = new Date(newObj[key])
            }
        }
        return newObj
    }

    // 1. Users
    console.log('Migrating Users...')
    for (const item of data.users) {
        await prisma.user.upsert({
            where: { id: item.id },
            update: fixDates(item),
            create: fixDates(item),
        })
    }

    // 2. Investors
    console.log('Migrating Investors...')
    for (const item of data.investors) {
        await prisma.investor.upsert({
            where: { id: item.id },
            update: fixDates(item),
            create: fixDates(item),
        })
    }

    // 3. Units
    console.log('Migrating Units...')
    for (const item of data.units) {
        await prisma.unit.upsert({
            where: { id: item.id },
            update: fixDates(item),
            create: fixDates(item),
        })
    }

    // 4. Transactions
    console.log('Migrating Transactions...')
    for (const item of data.transactions) {
        await prisma.transaction.upsert({
            where: { id: item.id },
            update: fixDates(item),
            create: fixDates(item),
        })
    }

    // 5. Transaction Proofs
    console.log('Migrating Transaction Proofs...')
    for (const item of data.transactionProofs) {
        await prisma.transactionProof.upsert({
            where: { id: item.id },
            update: fixDates(item),
            create: fixDates(item),
        })
    }

    // 6. Costs
    console.log('Migrating Costs...')
    for (const item of data.costs) {
        await prisma.cost.upsert({
            where: { id: item.id },
            update: fixDates(item),
            create: fixDates(item),
        })
    }

    // 7. Cost Proofs
    console.log('Migrating Cost Proofs...')
    for (const item of data.costProofs) {
        await prisma.costProof.upsert({
            where: { id: item.id },
            update: fixDates(item),
            create: fixDates(item),
        })
    }

    // 8. Profit Sharing
    console.log('Migrating Profit Sharing...')
    for (const item of data.profitSharings) {
        await prisma.profitSharing.upsert({
            where: { id: item.id },
            update: fixDates(item),
            create: fixDates(item),
        })
    }

    // 9. Payment History
    console.log('Migrating Payment History...')
    for (const item of data.paymentHistories) {
        await prisma.paymentHistory.upsert({
            where: { id: item.id },
            update: fixDates(item),
            create: fixDates(item),
        })
    }

    console.log('✅ Migrasi selesai dengan sukses!')
}

main()
    .catch((e) => {
        console.error('❌ Error saat impor:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
