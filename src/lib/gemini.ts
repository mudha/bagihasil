
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

export interface ParsedReceipt {
    totalAmount: number;
    amount: number; // Keep for backward compatibility (same as totalAmount)
    description: string;
    combinedDescription: string;
    date: string | null;
    latestDate: string | null;
    costType?: string;
}

export async function parseTransferProofs(
    files: { buffer: Buffer; mimeType: string }[]
): Promise<ParsedReceipt> {
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    try {
        const model = genAI.getGenerativeModel({ model: "models/gemini-flash-latest" });

        const prompt = `
            Andalah asisten ahli pembaca bukti transaksi/struk/nota untuk aplikasi manajemen operasional.
            Analisis ${files.length} gambar yang dikirimkan ini. Ini bisa berupa bukti pembayaran DP dan Pelunasan, atau transaksi terpisah.
            
            Tugas Anda:
            1. Total Nominal: Jumlahkan semua nominal uang yang valid dari SEMUA gambar. Abaikan saldo akhir, cari nominal transfer/bayar.
            2. Tanggal: Cari tanggal dari setiap gambar. Ambil tanggal PALING AKHIR (terbaru) sebagai tanggal utama.
            3. Deskripsi: Buat ringkasan deskripsi gabungan. Contoh: "Transfer 1: [Tgl] [Nominal], Transfer 2: [Tgl] [Nominal]".
            4. Kategori: Tentukan kategori umum (dominan).

            Pilihan Kategori:
            - INSPECTION, TRANSPORT, MEAL, TOLL, ADS, REPAIR, GAS, PARKING, STAMP_DUTY, BROKER, SALES, OTHER

            Kembalikan hasil dalam format JSON murni dengan key: 
            - "totalAmount" (number, total jumlahan)
            - "latestDate" (string YYYY-MM-DD or null, tanggal terbaru)
            - "combinedDescription" (string, deskripsi gabungan)
            - "costType" (string)

            Hanya kembalikan JSON, jangan sertakan markdown.
        `;

        const imageParts = files.map(file => ({
            inlineData: {
                data: file.buffer.toString("base64"),
                mimeType: file.mimeType,
            },
        }));

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        const text = response.text();

        // Robust JSON extraction
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("No JSON found in Gemini response from multipage:", text);
            throw new Error("Gagal mengambil data dari gambar.");
        }

        const cleanText = jsonMatch[0];
        const data = JSON.parse(cleanText);

        // Map new fields to interface, ensuring backward compatibility
        return {
            totalAmount: data.totalAmount || 0,
            amount: data.totalAmount || 0,
            latestDate: data.latestDate || null,
            date: data.latestDate || null,
            combinedDescription: data.combinedDescription || "",
            description: data.combinedDescription || "",
            costType: data.costType || "OTHER"
        } as ParsedReceipt;

    } catch (error: any) {
        console.error("Error parsing receipts with Gemini:", error);
        if (error.status === 429) {
            throw new Error("Quota AI (Gemini) sudah habis. Coba lagi nanti.");
        }
        throw error;
    }
}
