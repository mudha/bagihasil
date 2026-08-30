/**
 * Unit data constants and pure helpers.
 * Extracted from units/page.tsx for maintainability.
 *
 * This file has NO side effects, NO hooks, NO network, NO page imports.
 */

// ---------------------------------------------------------------------------
// Minimal type for getDuplicateInfo — covers only the fields it reads.
// The page-level `Unit` interface is wider; this contract keeps the helper
// decoupled from the full page state.
// ---------------------------------------------------------------------------
export interface UnitLike {
    id: string
    plateNumber: string
    createdAt?: string
}

// ---------------------------------------------------------------------------
// Vehicle reference data
// ---------------------------------------------------------------------------
export const VEHICLE_TYPES = ["Mobil", "Motor"] as const

export const BRANDS: Record<string, string[]> = {
    Mobil: [
        "Toyota", "Honda", "Daihatsu", "Mitsubishi", "Suzuki", "Wuling", "Hyundai", "Nissan", "Mazda", "BMW", "Mercedes-Benz", "Lexus", "Isuzu", "Kia", "Lainnya"
    ],
    Motor: [
        "Yamaha", "Honda", "Suzuki", "Kawasaki", "Vespa", "Piaggio", "BMW", "Ducati", "Harley-Davidson", "KTM", "Royal Enfield", "Lainnya"
    ]
}

export const MODELS: Record<string, Record<string, string[]>> = {
    Mobil: {
        Toyota: ["Avanza", "Innova", "Fortuner", "Alphard", "Veloz", "Rush", "Raize", "Agya", "Calya", "Yaris", "Camry"],
        Honda: ["Brio", "HR-V", "BR-V", "CR-V", "Civic", "City", "Mobilio", "Jazz", "WR-V"],
        Daihatsu: ["Xenia", "Terios", "Sigra", "Ayla", "Rocky", "Gran Max", "Luxio"],
        Mitsubishi: ["Xpander", "Xpander Cross", "Pajero Sport", "Triton", "L300"],
        Suzuki: ["Ertiga", "XL7", "Baleno", "Ignis", "Jimny", "S-Presso"],
    },
    Motor: {
        Yamaha: ["NMAX", "XMAX", "Aerox", "Lexi", "Fazzio", "Grand Filano", "Mio", "Vixion", "R15", "R25", "MT-15", "MT-25"],
        Honda: ["Beat", "Vario", "Scoopy", "PCX", "ADV", "Genio", "CBR150R", "CBR250RR", "CRF150L", "CB150R", "Sonic", "Supra X", "Revo"],
        Suzuki: ["Satria F150", "GSX-R150", "Address", "Nex II"],
        Kawasaki: ["Ninja 250", "KLX 150", "W175"],
        Vespa: ["Primavera", "Sprint", "LX", "S"],
    }
}

export const COLORS = ["Hitam", "Putih", "Silver", "Abu-abu", "Merah", "Biru", "Cokelat", "Hijau", "Kuning", "Oranye", "Ungu", "Lainnya"]

export const YEARS = Array.from({ length: 30 }, (_, i) => (new Date().getFullYear() + 1 - i).toString())

// ---------------------------------------------------------------------------
// getDuplicateInfo — pure helper for buyback/duplicate plate detection
// ---------------------------------------------------------------------------
export const getDuplicateInfo = (units: UnitLike[], currentUnit: UnitLike) => {
    // Safety check: return no duplicate if plateNumber is missing
    if (!currentUnit.plateNumber || !currentUnit.plateNumber.trim()) {
        return { isDuplicate: false, purchaseNumber: 1, totalDuplicates: 1, isBuyback: false }
    }

    const samePlateUnits = units
        .filter(u => u.plateNumber && u.plateNumber.toLowerCase().trim() === currentUnit.plateNumber.toLowerCase().trim())
        .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())

    const index = samePlateUnits.findIndex(u => u.id === currentUnit.id)
    const purchaseNumber = index + 1
    const totalDuplicates = samePlateUnits.length

    // Determine if this specific unit instance is a buyback (not the first one)
    const isBuyback = purchaseNumber > 1

    return {
        isDuplicate: totalDuplicates > 1,
        purchaseNumber,
        totalDuplicates,
        isBuyback
    }
}
