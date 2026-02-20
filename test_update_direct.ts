import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Get investor
    const investor = await prisma.investor.findFirst();
    if (!investor) throw new Error("No investor");

    // 2. Create a dummy unit
    const unit = await prisma.unit.create({
        data: {
            name: "Original Name",
            plateNumber: "OLD 123",
            code: "TEST-" + Date.now(),
            investorId: investor.id,
            status: "AVAILABLE",
        }
    });

    console.log("Created unit:", unit.id);

    // 3. Update with the exact payload Prisma gets
    try {
        const payload = {
            investorId: investor.id,
            name: "Suzuki Ertiga 2019 warna Abu-abu",
            plateNumber: "A 1294 YQ",
            code: unit.code,
            imageUrl: "https://ik.imagekit.io/abuNaurah/test.jpg", // simulate successful upload
            taxDueDate: null,
            status: "SOLD",
            vehicleType: "Mobil",
            brand: "Suzuki",
            model: "Ertiga",
            year: "2019",
            color: "Abu-abu",
            stnkImageUrl: null,
            engineNumber: "",
            chassisNumber: ""
        };

        const result = await prisma.unit.update({
            where: { id: unit.id },
            data: payload
        });
        console.log("Update success:", result.id);
    } catch (e: any) {
        console.error("Update failed:", e.message);
    } finally {
        await prisma.unit.delete({ where: { id: unit.id } });
    }
}

main().finally(() => prisma.$disconnect());
