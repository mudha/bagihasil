import { z } from 'zod';

const unitSchemaFront = z.object({
    name: z.string().min(1, "Nama unit wajib diisi"),
    plateNumber: z.string().min(1, "Nomor polisi wajib diisi"),
    code: z.string().min(1, "Kode unit wajib diisi"),
    investorId: z.string().min(1, "Pemodal wajib dipilih"),
    status: z.enum(["AVAILABLE", "SOLD", "MAINTENANCE"]).optional(),
    imageUrl: z.string().optional().nullable(),
    taxDueDate: z.date().optional().nullable(),
    vehicleType: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    year: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    stnkImageUrl: z.string().optional().nullable(),
    engineNumber: z.string().optional().nullable(),
    chassisNumber: z.string().optional().nullable(),
});

const unitSchemaBack = z.object({
    investorId: z.string(),
    name: z.string().min(1),
    plateNumber: z.string().min(1),
    code: z.string().min(1),
    imageUrl: z.string().optional().nullable(),
    taxDueDate: z.coerce.date().optional().nullable(),
    status: z.enum(["AVAILABLE", "SOLD", "MAINTENANCE"]).optional().default("AVAILABLE"),
    vehicleType: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    year: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    stnkImageUrl: z.string().optional().nullable(),
    engineNumber: z.string().optional().nullable(),
    chassisNumber: z.string().optional().nullable(),
});

const dummyPayload = {
    name: "Suzuki Ertiga 2019 warna Abu-abu",
    plateNumber: "A 1294 YQ",
    code: "SA-UNIT-1771558324075-4",
    investorId: "clxxxxxxxxx",
    status: "SOLD",
    imageUrl: "https://ik.imagekit.io/abuNaurah/test.jpg",
    taxDueDate: null, // this could be what fails back end
    vehicleType: "Mobil",
    brand: "Suzuki",
    model: "Ertiga",
    year: "2019",
    color: "Abu-abu",
    stnkImageUrl: null,
    engineNumber: "",
    chassisNumber: ""
};

console.log("Frontend schema:");
const res1 = unitSchemaFront.safeParse(dummyPayload);
console.log(res1.success ? "OK" : JSON.stringify(res1.error.issues, null, 2));

console.log("Backend schema stringifying taxDueDate to null:");
const payloadStr = JSON.stringify(dummyPayload);
const payloadObj = JSON.parse(payloadStr);
const res2 = unitSchemaBack.safeParse(payloadObj);
console.log(res2.success ? "OK" : JSON.stringify(res2.error.issues, null, 2));
