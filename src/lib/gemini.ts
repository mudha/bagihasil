
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

export interface ParsedReceipt {
    amount: number;
    description: string;
    date: string | null;
    costType?: string;
}

export async function parseTransferProof(
    fileBuffer: Buffer,
    mimeType: string
): Promise<ParsedReceipt> {
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    try {
        const model = genAI.getGenerativeModel({ model: "models/gemini-flash-latest" });

        const prompt = `
            Andalah asisten ahli pembaca bukti transaksi/struk/nota untuk aplikasi manajemen operasional.
            Analisis gambar bukti transfer atau struk ini dan ekstrak informasi berikut:
            1. Total nominal transaksi (angka saja, hilangkan simbol mata uang).
            2. Tanggal transaksi (format YYYY-MM-DD). Jika tidak ditemukan, kembalikan null.
            3. Deskripsi singkat transaksi (misal: "Pembelian Pertamax", "Makan Malam Tim", "Tol Jakarta-Cikampek").
            4. Kategorikan jenis biaya ke salah satu pilihan berikut:
               - INSPECTION: untuk biaya cek unit/inspeksi
               - TRANSPORT: untuk biaya towing, pengiriman unit
               - MEAL: untuk makan/minum
               - TOLL: untuk biaya tol
               - ADS: untuk iklan (olx, fb ads, dll)
               - REPAIR: untuk perbaikan mobil/motor, ganti oli, servis
               - GAS: untuk bensin/bahan bakar
               - PARKING: untuk parkir
               - STAMP_DUTY: untuk materai
               - BROKER: untuk fee makelar
               - SALES: untuk komisi sales
               - OTHER: jika tidak masuk kategori di atas

            Kembalikan hasil dalam format JSON murni dengan key: "amount" (number), "date" (string or null), "description" (string), "costType" (string, pilih salah satu kode di atas).
            Hanya kembalikan JSON, jangan sertakan markdown format seperti \`\`\`json.
        `;

        const imagePart = {
            inlineData: {
                data: fileBuffer.toString("base64"),
                mimeType,
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        // Robust JSON extraction: find first '{' and last '}'
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("No JSON found in Gemini response:", text);
            throw new Error("Gagal mengambil data dari gambar. format tidak dikenali.");
        }

        const cleanText = jsonMatch[0];
        return JSON.parse(cleanText) as ParsedReceipt;
    } catch (error: any) {
        console.error("Error parsing receipt with Gemini:", error);
        if (error.status === 429) {
            throw new Error("Quota AI (Gemini) sudah habis untuk saat ini. Mohon coba lagi nanti.");
        }
        throw error;
    }
}
