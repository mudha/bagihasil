const INVESTOR_TONES = [
    {
        accent: "#2563eb",
        rowBg: "#eff6ff",
        chipBg: "#dbeafe",
        chipText: "#1e3a8a",
        stripe: "linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)",
    },
    {
        accent: "#16a34a",
        rowBg: "#f0fdf4",
        chipBg: "#dcfce7",
        chipText: "#14532d",
        stripe: "linear-gradient(90deg, #16a34a 0%, #84cc16 100%)",
    },
    {
        accent: "#f59e0b",
        rowBg: "#fffbeb",
        chipBg: "#fef3c7",
        chipText: "#78350f",
        stripe: "linear-gradient(90deg, #f59e0b 0%, #f97316 100%)",
    },
    {
        accent: "#dc2626",
        rowBg: "#fef2f2",
        chipBg: "#fee2e2",
        chipText: "#7f1d1d",
        stripe: "linear-gradient(90deg, #dc2626 0%, #fb7185 100%)",
    },
    {
        accent: "#4f46e5",
        rowBg: "#eef2ff",
        chipBg: "#e0e7ff",
        chipText: "#312e81",
        stripe: "linear-gradient(90deg, #4f46e5 0%, #818cf8 100%)",
    },
    {
        accent: "#db2777",
        rowBg: "#fdf2f8",
        chipBg: "#fce7f3",
        chipText: "#831843",
        stripe: "linear-gradient(90deg, #db2777 0%, #f472b6 100%)",
    },
    {
        accent: "#0f766e",
        rowBg: "#f0fdfa",
        chipBg: "#ccfbf1",
        chipText: "#134e4a",
        stripe: "linear-gradient(90deg, #0f766e 0%, #2dd4bf 100%)",
    },
    {
        accent: "#475569",
        rowBg: "#f8fafc",
        chipBg: "#e2e8f0",
        chipText: "#0f172a",
        stripe: "linear-gradient(90deg, #475569 0%, #94a3b8 100%)",
    },
] as const

const INVESTOR_TONE_OVERRIDES: Record<string, (typeof INVESTOR_TONES)[number]> = {
    "wahyu prasetyo adi": INVESTOR_TONES[0],
    "achmad firmansyah": INVESTOR_TONES[2],
    "wiwin yuli widiastuti": INVESTOR_TONES[5],
}

export const getInvestorTone = (investorKey?: string | null) => {
    const value = investorKey?.trim().toLowerCase().replace(/\s+/g, " ") || "unknown-investor"
    const override = INVESTOR_TONE_OVERRIDES[value]

    if (override) return override

    let hash = 0

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0
    }

    return INVESTOR_TONES[hash % INVESTOR_TONES.length]
}
