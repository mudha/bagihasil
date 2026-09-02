
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

    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
    let lastError: any;

    for (const modelName of models) {
        try {
            console.log(`Attempting analysis with model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });

            const prompt = `
                Andalah asisten ahli pembaca bukti transaksi/struk/nota untuk aplikasi manajemen operasional.
                Analisis ${files.length} gambar yang dikirimkan ini. Ini bisa berupa bukti pembayaran DP dan Pelunasan, atau transaksi terpisah.
                
                Tugas Anda:
                1. Total Nominal: Jumlahkan semua nominal uang yang valid dari SEMUA gambar. Abaikan saldo akhir, cari nominal transfer/bayar.
                2. Tanggal: Cari tanggal dari setiap gambar. Ambil tanggal PALING AKHIR (terbaru) sebagai tanggal utama.
                3. Deskripsi: Ekstrak secara langsung catatan, pesan, atau berita transfer yang ada di gambar tanpa diubah. JANGAN sertakan tanggal atau awalan seperti "Transfer 1:" di dalam deskripsi ini. Cukup ambil isi beritanya saja secara mentah (contoh: "bagi hasil project ke 47"). Jika tidak ada catatan, biarkan string kosong. Jika ada beberapa gambar, gabungkan dengan koma.
                4. Kategori: Tentukan kategori umum (dominan).
    
                Pilihan Kategori (Pilih salah satu yang paling cocok):
                - TRANSPORT: Ojek online (Gojek, Grab, Maxim), taksi, tiket kereta/travel
                - GAS: Struk SPBU (Pertamina, Shell, BP), bensin, solar
                - MEAL: Makanan, restoran, warung, GrabFood/GoFood, minuman
                - TOLL: Struk top-up e-Toll, struk gerbang tol
                - PARKING: Karcis/struk parkir
                - REPAIR: Bengkel, sparepart, ganti oli, cuci mobil/motor
                - INSPECTION: Biaya cek fisik, jasa inspeksi kendaraan
                - ADS: Iklan (OLX, Facebook Ads, dll)
                - STAMP_DUTY: Pembelian materai
                - BROKER: Fee makelar/perantara
                - SALES: Komisi penjualan
                - TAX: Pajak kendaraan, STNK, Samsat, PKB, SWDKLLJ, atau denda pajak
                - OTHER: Jika tidak masuk ke kategori mana pun di atas
    
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
                console.error(`No JSON found in Gemini response (${modelName}):`, text);
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
            console.error(`Error with model ${modelName}:`, error);
            lastError = error;

            // If quota error (429) or Service Unavailable (503), try next model with a small delay
            if (error.status === 429 || error.status === 503 || error.message?.includes("Quota")) {
                console.warn(`Model ${modelName} hit rate limit or unavailable. Switching to fallback...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
                continue;
            }

            // For other errors (checking if it's not the last model), we might still want to try next model 
            // incase one model is broken but another works (e.g. 404).
            // But usually 400 is prompt error. Let's be aggressive and fallback on most errors except config ones.
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
        }
    }

    // If loop finishes without return
    if (lastError) {
        if (lastError.status === 429) {
            throw new Error("Quota AI (Gemini) sudah habis. Coba lagi nanti.");
        }
        throw lastError;
    }
    throw new Error("Gagal memproses gambar setelah mencoba beberapa model.");

}

export interface ParsedStnk {
    plateNumber: string | null;
    taxDueDate: string | null;
    engineNumber: string | null;
    chassisNumber: string | null;
    color: string | null;
    vehicleType: "Mobil" | "Motor" | null;
    brand: string | null;
    model: string | null;
    year: string | null;
    vehicleTypeCode?: string | null; // Added field for raw type code
}

export async function parseStnk(
    file: { buffer: Buffer; mimeType: string }
): Promise<ParsedStnk> {
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
    let lastError: any;

    for (const modelName of models) {
        try {
            console.log(`Attempting STNK analysis with model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });

            const prompt = `
                Andalah AI ahli pembaca dokumen STNK Indonesia (Surat Tanda Nomor Kendaraan).
                Analisis gambar STNK ini dan ekstrak data berikut dengan sangat teliti.
    
                **Konteks Validasi:**
                - **Jenis Kendaraan**: "Mobil" atau "Motor". (Mobil biasanya > 1000cc, Motor < 1000cc, atau lihat bentuk fisik jika ada foto kendaraan).
                - **Merek Populer**: Toyota, Honda, Yamaha, Suzuki, Mitsubishi, Daihatsu, Kawasaki, Vespa, dll.
                - **Warna Populer**: Hitam, Putih, Silver, Abu-abu, Merah, Biru, Cokelat, Hijau, Kuning, Oranye, Ungu.
    
                **Tugas Ekstraksi:**
                1. **Nomor Polisi (Plate Number)**: Cari format B 1234 ABC. Hapus spasi berlebih.
                2. **Masa Berlaku Pajak (Tax Due Date)**: Cari tanggal "Berlaku s/d" atau tanggal validitas pajak. Format YYYY-MM-DD.
                3. **Nomor Mesin (Engine Number)**: Label "No. Mesin".
                4. **Nomor Rangka (Chassis Number)**: Label "No. Rangka" atau "NIK".
                5. **Warna Kendaraan (Color)**: Cari label "Warna". Coba cocokkan dengan daftar warna populer di atas.
                6. **Jenis Kendaraan (Vehicle Type)**: Tentukan apakah "Mobil" atau "Motor" berdasarkan Merek, Model, atau Isi Silinder.
                7. **Merek (Brand)**: Contoh: Toyota, Honda, Yamaha.
                8. **Model**: Contoh: Avanza, XMAX, Beat, Brio. (Ambil kata kunci model utama).
                9. **Tahun Pembuatan (Year)**: Cari label "Tahun Pembuatan" atau "Thn Rakit". Ambil 4 digit tahun (YYYY).
                10. **Kode Tipe Kendaraan (Vehicle Type Code)**: Cari label "Tipe" atau "Type" (BUKAN label "Jenis"). Ini biasanya berisi kode seperti "BG6 AT", "BPV AT", "AVANZA 1.3 E M/T". Salin persis apa yang tertulis.
                
                **Instruksi Khusus (Wajib Diikuti):**
                - Jika Kode Tipe Kendaraan mengandung "BG6" atau "BPV", maka pastikan Brand="Yamaha", Model="XMAX", vehicleType="Motor".
                - Jika Kode Tipe Kendaraan mengandung "BEJ", maka pastikan Brand="Yamaha", Model="Fazzio", vehicleType="Motor".

                **Format Output JSON Murni:**
                {
                    "plateNumber": "string/null",
                    "taxDueDate": "YYYY-MM-DD/null",
                    "engineNumber": "string/null",
                    "chassisNumber": "string/null",
                    "color": "string/null",
                    "vehicleType": "Mobil/Motor/null",
                    "brand": "string/null",
                    "model": "string/null",
                    "year": "string/null",
                    "vehicleTypeCode": "string/null"
                }
            `;

            const imagePart = {
                inlineData: {
                    data: file.buffer.toString("base64"),
                    mimeType: file.mimeType,
                },
            };

            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error(`No JSON found in STNK response (${modelName}):`, text);
                throw new Error("Gagal mengenali data STNK.");
            }

            const data = JSON.parse(jsonMatch[0]);

            // We removed hardcoded typescript mappings. The LLM prompt now handles specific vehicle codes.
            const finalBrand = data.brand;
            const finalModel = data.model;
            const finalVehicleType = data.vehicleType;


            return {
                plateNumber: data.plateNumber || null,
                taxDueDate: data.taxDueDate || null,
                engineNumber: data.engineNumber || null,
                chassisNumber: data.chassisNumber || null,
                color: data.color || null,
                vehicleType: finalVehicleType || null,
                brand: finalBrand || null,
                model: finalModel || null,
                year: data.year || null,
                vehicleTypeCode: data.vehicleTypeCode || null
            };

        } catch (error: any) {
            console.error(`Error with model ${modelName}:`, error);
            lastError = error;

            if (error.status === 429 || error.status === 503 || error.message?.includes("Quota")) {
                console.warn(`Model ${modelName} hit rate limit or unavailable. Switching to fallback...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
        }
    }

    if (lastError) {
        if (lastError.status === 429) {
            throw new Error("Quota AI habis.");
        }
        throw new Error("Gagal memproses STNK: " + lastError.message);
    }
    throw new Error("Gagal memproses STNK setelah mencoba beberapa model.");
}
