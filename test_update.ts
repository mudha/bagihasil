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

    // 3. Try to update it identically to what the API would receive
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

    console.log("Sending payload...");

    const response = await fetch(`http://localhost:3000/api/units/${unit.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            // Mimic admin session or use a mock if we bypass auth.
            // Wait, we can't easily bypass next-auth in fetch. 
        },
        body: JSON.stringify(payload)
    });

    if (response.ok) {
        console.log("Success:", await response.json());
    } else {
        console.error("Failed:", response.status, await response.text());
    }
}

main().finally(() => prisma.$disconnect());
