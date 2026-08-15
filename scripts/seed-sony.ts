import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const data = `1; Ford Fiesta Trend Facelift AT 2013 ;11/08/2024;16/08/2024; 80,000,000.00 ; 600,000.00 ; 73,000.00 ; 69,000.00 ; 72,500.00 ;; 47,432.00 ; 24,000.00 ;; 40,000,000.00 ; 40,000,000.00 ; 40,885,932.00 ; 49.45 ; 50.55 ; 80,885,932.00 ; 85,000,000.00 ; 4,114,068.00 ; 2,034,503.60 ; 2,079,564.40 ; 42,034,503.60 ; 41,784,503.60 
2; Daihatsu Sigra Type M MT 2017 ;23/08/2024;26/08/2024; 80,000,000.00 ; 300,000.00 ; 112,500.00 ;; 72,500.00 ;; 500,000.00 ;;; 40,000,000.00 ; 40,000,000.00 ; 40,985,000.00 ; 49.39 ; 50.61 ; 80,985,000.00 ; 85,000,000.00 ; 4,015,000.00 ; 1,983,083.29 ; 2,031,916.71 ; 41,983,083.29 ; 41,733,083.29 
3; Toyota Sienta Type G MT 2017 ;01/09/2024;10/09/2024; 123,000,000.00 ; 500,000.00 ; 138,500.00 ;;; 47,873.00 ;; 12,000.00 ; 5,000,000.00 ; 68,000,000.00 ; 55,000,000.00 ; 60,698,373.00 ; 52.84 ; 47.16 ; 128,698,373.00 ; 140,000,000.00 ; 11,301,627.00 ; 5,971,409.10 ; 5,330,217.90 ; 73,971,409.10 ; 73,721,409.10 
4; Suzuki Ertiga Type GL AT 2019 ;13/10/2024;10/11/2024; 150,600,000.00 ; 500,000.00 ; 157,000.00 ; 52,000.00 ; 41,000.00 ; 105,483.00 ; 1,845,000.00 ; 12,000.00 ;; 100,000,000.00 ; 50,600,000.00 ; 53,312,483.00 ; 65.23 ; 34.77 ; 153,312,483.00 ; 157,000,000.00 ; 3,687,517.00 ; 2,405,229.46 ; 1,282,287.54 ; 102,405,229.46 ; 102,155,229.46 
5; Daihatsu Ayla Type R Deluxe MT 2018 ;01/12/2024;23/12/2024; 92,500,000.00 ; 400,000.00 ; 2,000,000.00 ; 71,000.00 ;;; 510,000.00 ;; 1,500,000.00 ; 52,000,000.00 ; 40,500,000.00 ; 44,981,000.00 ; 53.62 ; 46.38 ; 96,981,000.00 ; 102,000,000.00 ; 5,019,000.00 ; 2,691,125.07 ; 2,327,874.93 ; 54,691,125.07 ; 54,441,125.07`;

function parseDate(dateStr: string) {
    const [day, month, year] = dateStr.split('/');
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

function parseNumber(numStr: string) {
    if (!numStr || numStr.trim() === '') return 0;
    return parseFloat(numStr.replace(/,/g, ''));
}

async function main() {
    console.log('Starting seed...');

    // 1. Get or create Investor Sony Agusta
    let investor = await prisma.investor.findFirst({
        where: { name: { contains: 'Sony Agusta' } }
    });

    if (!investor) {
        investor = await prisma.investor.create({
            data: {
                name: 'Sony Agusta',
                contactInfo: '',
                marginPercentage: 50.0,
            }
        });
        console.log('Created Investor Sony Agusta', investor.id);
    } else {
        console.log('Found Investor Sony Agusta', investor.id);
    }

    const lines = data.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const cols = line.split(';').map(c => c.trim());
        if (cols.length < 25) continue;

        const [
            no, unitName, buyDateStr, sellDateStr, buyPriceStr,
            inspStr, transportStr, mealsStr, tollStr, adsStr, repairStr, legalStr, brokerStr,
            investorPStr, managerPStr, managerTotalStr,
            investorPctStr, managerPctStr, totalModalStr, sellPriceStr,
            marginStr, investorProfitStr, managerProfitStr
        ] = cols;

        try {
            const code = `SA-UNIT-${Date.now()}-${no}`;
            const buyDate = parseDate(buyDateStr);
            const sellDate = parseDate(sellDateStr);
            const buyPrice = parseNumber(buyPriceStr);
            const sellPrice = parseNumber(sellPriceStr);

            const unit = await prisma.unit.create({
                data: {
                    name: unitName,
                    code: code,
                    investorId: investor.id,
                    status: 'SOLD',
                    createdAt: buyDate,
                    updatedAt: sellDate,
                }
            });
            console.log(`Created Unit: ${unit.name}`);

            const transactionCode = `TRX-SA-${Date.now()}-${no}`;
            const transaction = await prisma.transaction.create({
                data: {
                    unitId: unit.id,
                    transactionCode,
                    buyDate,
                    sellDate,
                    buyPrice,
                    sellPrice,
                    status: 'COMPLETED',
                    profitStatus: 'PROFIT',
                    paymentStatus: 'PAID',
                    initialInvestorCapital: parseNumber(investorPStr),
                    initialManagerCapital: parseNumber(managerPStr),
                    createdAt: buyDate,
                    updatedAt: sellDate,
                }
            });
            console.log(`Created Transaction: ${transaction.transactionCode}`);

            // Add Costs
            const costMapping = [
                { type: 'INSPECTION', amount: parseNumber(inspStr) },
                { type: 'TRANSPORT', amount: parseNumber(transportStr) },
                { type: 'MEALS', amount: parseNumber(mealsStr) },
                { type: 'TOLL', amount: parseNumber(tollStr) },
                { type: 'ADS', amount: parseNumber(adsStr) },
                { type: 'REPAIR', amount: parseNumber(repairStr) },
                { type: 'LEGAL', amount: parseNumber(legalStr) },
                { type: 'BROKER', amount: parseNumber(brokerStr) },
            ];

            for (const cost of costMapping) {
                if (cost.amount > 0) {
                    await prisma.cost.create({
                        data: {
                            transactionId: transaction.id,
                            costType: cost.type,
                            payer: 'MANAGER',
                            amount: cost.amount,
                            date: buyDate,
                            createdAt: buyDate,
                            updatedAt: sellDate,
                        }
                    });
                }
            }

            // Add Profit Sharing
            await prisma.profitSharing.create({
                data: {
                    transactionId: transaction.id,
                    totalCapitalInvestor: parseNumber(investorPStr),
                    totalCapitalManager: parseNumber(managerTotalStr),
                    totalCapital: parseNumber(totalModalStr),
                    netMargin: parseNumber(marginStr),
                    investorSharePercentage: parseNumber(investorPctStr),
                    managerSharePercentage: parseNumber(managerPctStr),
                    investorProfitAmount: parseNumber(investorProfitStr),
                    managerProfitAmount: parseNumber(managerProfitStr),
                    calculatedAt: sellDate,
                }
            });

            console.log(`Added data for unit ${no}`);

        } catch (e) {
            console.error(`Error processing row ${no}:`, e);
        }
    }

    console.log('Seed completed successfully!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
