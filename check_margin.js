
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const transactionId = 'cmiug5s9p006mpx9v8nzxm4pm';
    try {
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: {
                unit: {
                    include: {
                        investor: true
                    }
                },
                profitSharing: true
            }
        });

        if (!transaction) {
            console.log('Transaction not found');
            return;
        }

        console.log('Transaction Status:', transaction.status);
        console.log('Investor Name:', transaction.unit.investor.name);
        console.log('Investor Configured Margin:', transaction.unit.investor.marginPercentage);

        if (transaction.profitSharing) {
            console.log('Recorded Investor Share:', transaction.profitSharing.investorSharePercentage);
            console.log('Recorded Manager Share:', transaction.profitSharing.managerSharePercentage);
        } else {
            console.log('No profit sharing record (transaction not completed)');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
