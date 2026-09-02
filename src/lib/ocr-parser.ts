
import { createWorker } from 'tesseract.js';
import { ParsedReceipt } from './gemini';

// Basic worker cache attempt to reuse, though Next.js serverless might reset this.
let cachedWorker: any = null;

export async function parseReceiptWithOCR(
    buffer: Buffer,
    _mimeType: string
): Promise<ParsedReceipt> {
    console.log("Starting OCR fallback...");

    // Create new worker if not cached
    if (!cachedWorker) {
        cachedWorker = await createWorker('ind', 1, {
            logger: () => { }, // Disable all logs
            cachePath: './.tesseract_cache', // Attempt to simplify cache loc
            gzip: true
        });
    }

    try {
        const ret = await cachedWorker.recognize(buffer);
        const text = ret.data.text;
        // console.log("OCR Result:", text.slice(0, 50)); 

        // Don't terminate, let it linger for potential reuse if within same lambda context
        // await cachedWorker.terminate(); 

        return extractDataFromText(text);
    } catch (error) {
        console.error("OCR Error:", error);
        if (cachedWorker) {
            await cachedWorker.terminate();
            cachedWorker = null; // Reset cache on error
        }
        throw new Error("Gagal membaca gambar dengan OCR");
    }
}

export function extractDataFromText(text: string): ParsedReceipt {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const textLower = text.toLowerCase();

    // 1. Extract Amount
    // Look for Total, Jumlah, Bayar, Harga followed by numbers
    const amountRegex = /(?:total|jumlah|harga|bayar|subtotal|tagihan)[\D]*?((?:rp|idr)?[\s\.]*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i;
    let amount = 0;

    // First try to find specific "Total" lines
    const totalMatch = text.match(amountRegex);
    if (totalMatch) {
        amount = parseCurrency(totalMatch[1]);
    } else {
        // Fallback: look for the largest number in the text which often represents total
        const allNumbers = text.match(/((?:rp|idr)?[\s\.]*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/gi);
        if (allNumbers) {
            const numbers = allNumbers.map(n => parseCurrency(n));
            amount = Math.max(...numbers);
        }
    }

    // 2. Extract Date
    // Formats: DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, DD Month YYYY
    const dateRegex = /(\d{1,2}[-/\s](\d{1,2}|jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)[-/\s]\d{2,4})/i;
    const dateMatch = text.match(dateRegex);
    let date: string | null = null;

    if (dateMatch) {
        try {
            // Simplified date parsing, ideally use date-fns or moment
            // For now, return what we found or try to standardize
            date = normalizeDate(dateMatch[0]);
        } catch (e) {
            console.error("Date parse error", e);
        }
    }

    // 3. Determine Cost Type (Keyword matching)
    let costType = "OTHER";
    if (/pajak|stnk|samsat|pkb|sw?dkllj/i.test(textLower)) costType = "TAX";
    else if (/bensin|pertalite|pertamax|solar|shell|spbu|pom/i.test(textLower)) costType = "GAS";
    else if (/tol|jasa marga|marga/i.test(textLower)) costType = "TOLL";
    else if (/makan|resto|cafe|warung|minum/i.test(textLower)) costType = "MEAL";
    else if (/parkir/i.test(textLower)) costType = "PARKING";
    else if (/bengkel|servis|sparepart|oli|ban/i.test(textLower)) costType = "REPAIR";
    else if (/iklan|ads/i.test(textLower)) costType = "ADS";
    else if (/materai/i.test(textLower)) costType = "STAMP_DUTY";
    else if (/towing|kirim/i.test(textLower)) costType = "TRANSPORT";
    else if (/inspeksi|cek fisik/i.test(textLower)) costType = "INSPECTION";

    // 4. Description
    // Use the first non-empty line or synthesize from keywords
    let description = lines[0] || "Bukti Transaksi";
    // Try to find a line with store/merchant name? Usually at top.
    // If we found cost type, maybe append it
    if (costType !== "OTHER" && description.length < 5) {
        description = `Biaya ${costType}`;
    }

    return {
        amount,
        date,
        description,
        costType,
        totalAmount: amount,
        combinedDescription: description,
        latestDate: date
    };
}

function parseCurrency(str: string): number {
    // Remove non-numeric characters except for delimiters
    // Handle Indonesian format: 1.000,00 or 1,000.00
    // Simple heuristic: remove all non-digits, divide by 100 if it looks like cents included? 
    // Actually safe bet: remove all non-digits. 
    // BUT decimals matter.
    // Let's assume standard IDR usually doesn't have cents often on receipts OR uses comma.

    // Remove "Rp", "IDR", dots, spaces
    let clean = str.replace(/[^\d,\.]/g, '');

    // If ends with ,00 or .00, remove it
    clean = clean.replace(/[,.]00$/, '');

    // Remove all remaining dots/commas
    clean = clean.replace(/[,.]/g, '');

    return parseInt(clean) || 0;
}

function normalizeDate(dateStr: string): string | null {
    // Basic normalization to YYYY-MM-DD for form input
    // This is tricky without a library, returning the raw string might be safer for now,
    // but the input type="date" requires YYYY-MM-DD.
    // Let's try best effort or return null.

    // Pass to Date constructor
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
    }
    return null;
}
