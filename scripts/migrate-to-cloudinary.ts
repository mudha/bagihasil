
import { PrismaClient } from '@prisma/client'
import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const prisma = new PrismaClient()

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

async function uploadToCloudinary(localPath: string, folder: string) {
    const absolutePath = path.join(process.cwd(), 'public', localPath)

    if (!fs.existsSync(absolutePath)) {
        console.warn(`File not found: ${absolutePath}`)
        return null
    }

    try {
        const result = await cloudinary.uploader.upload(absolutePath, {
            folder: `profit-sharing-app/${folder}`,
        })
        return result.secure_url
    } catch (error) {
        console.error(`Error uploading ${localPath}:`, error)
        return null
    }
}

async function migrate() {
    console.log('Starting migration to Cloudinary...')

    // 1. Units
    const units = await prisma.unit.findMany({
        where: { imageUrl: { startsWith: '/uploads/' } }
    })
    console.log(`Found ${units.length} units to migrate.`)
    for (const unit of units) {
        const cloudUrl = await uploadToCloudinary(unit.imageUrl!, 'units')
        if (cloudUrl) {
            await prisma.unit.update({
                where: { id: unit.id },
                data: { imageUrl: cloudUrl }
            })
            console.log(`Migrated unit ${unit.id}`)
        }
    }

    // 2. Transactions
    const transactionsBuy = await prisma.transaction.findMany({
        where: { buyProofImageUrl: { startsWith: '/uploads/' } }
    })
    console.log(`Found ${transactionsBuy.length} transaction buy proofs to migrate.`)
    for (const trx of transactionsBuy) {
        const cloudUrl = await uploadToCloudinary(trx.buyProofImageUrl!, 'payment-proofs')
        if (cloudUrl) {
            await prisma.transaction.update({
                where: { id: trx.id },
                data: { buyProofImageUrl: cloudUrl }
            })
            console.log(`Migrated transaction buy proof ${trx.id}`)
        }
    }

    const transactionsSell = await prisma.transaction.findMany({
        where: { sellProofImageUrl: { startsWith: '/uploads/' } }
    })
    console.log(`Found ${transactionsSell.length} transaction sell proofs to migrate.`)
    for (const trx of transactionsSell) {
        const cloudUrl = await uploadToCloudinary(trx.sellProofImageUrl!, 'payment-proofs')
        if (cloudUrl) {
            await prisma.transaction.update({
                where: { id: trx.id },
                data: { sellProofImageUrl: cloudUrl }
            })
            console.log(`Migrated transaction sell proof ${trx.id}`)
        }
    }

    // 3. TransactionProof
    const transactionProofs = await prisma.transactionProof.findMany({
        where: { imageUrl: { startsWith: '/uploads/' } }
    })
    console.log(`Found ${transactionProofs.length} transaction proofs to migrate.`)
    for (const proof of transactionProofs) {
        const cloudUrl = await uploadToCloudinary(proof.imageUrl, 'payment-proofs')
        if (cloudUrl) {
            await prisma.transactionProof.update({
                where: { id: proof.id },
                data: { imageUrl: cloudUrl }
            })
            console.log(`Migrated transaction proof ${proof.id}`)
        }
    }

    // 4. CostProof
    const costProofs = await prisma.costProof.findMany({
        where: { imageUrl: { startsWith: '/uploads/' } }
    })
    console.log(`Found ${costProofs.length} cost proofs to migrate.`)
    for (const proof of costProofs) {
        const cloudUrl = await uploadToCloudinary(proof.imageUrl, 'payment-proofs')
        if (cloudUrl) {
            await prisma.costProof.update({
                where: { id: proof.id },
                data: { imageUrl: cloudUrl }
            })
            console.log(`Migrated cost proof ${proof.id}`)
        }
    }

    // 5. PaymentHistory
    const paymentHistories = await prisma.paymentHistory.findMany({
        where: { proofImageUrl: { startsWith: '/uploads/' } }
    })
    console.log(`Found ${paymentHistories.length} payment histories to migrate.`)
    for (const history of paymentHistories) {
        const cloudUrl = await uploadToCloudinary(history.proofImageUrl!, 'payment-proofs')
        if (cloudUrl) {
            await prisma.paymentHistory.update({
                where: { id: history.id },
                data: { proofImageUrl: cloudUrl }
            })
            console.log(`Migrated payment history ${history.id}`)
        }
    }

    console.log('Migration completed!')
}

migrate()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
