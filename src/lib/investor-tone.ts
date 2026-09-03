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

/* ───────── Dark-mode palette ───────── */

interface InvestorToneDark {
    accent: string
    rowBg: string
    chipBg: string
    chipText: string
    stripe: string
}

/** Per-index dark overrides. Accent & stripe stay the same; backgrounds & text adapt. */
const DARK_OVERRIDES: InvestorToneDark[] = [
    { accent: "#60a5fa", rowBg: "rgba(37,99,235,0.08)", chipBg: "rgba(37,99,235,0.18)", chipText: "#93c5fd", stripe: "linear-gradient(90deg, #60a5fa 0%, #38bdf8 100%)" },
    { accent: "#4ade80", rowBg: "rgba(22,163,74,0.08)", chipBg: "rgba(22,163,74,0.18)", chipText: "#86efac", stripe: "linear-gradient(90deg, #4ade80 0%, #a3e635 100%)" },
    { accent: "#fbbf24", rowBg: "rgba(245,158,11,0.08)", chipBg: "rgba(245,158,11,0.18)", chipText: "#fde68a", stripe: "linear-gradient(90deg, #fbbf24 0%, #fb923c 100%)" },
    { accent: "#f87171", rowBg: "rgba(220,38,38,0.08)", chipBg: "rgba(220,38,38,0.18)", chipText: "#fca5a5", stripe: "linear-gradient(90deg, #f87171 0%, #fb7185 100%)" },
    { accent: "#818cf8", rowBg: "rgba(79,70,229,0.08)", chipBg: "rgba(79,70,229,0.18)", chipText: "#a5b4fc", stripe: "linear-gradient(90deg, #818cf8 0%, #c4b5fd 100%)" },
    { accent: "#f472b6", rowBg: "rgba(219,39,119,0.08)", chipBg: "rgba(219,39,119,0.18)", chipText: "#f9a8d4", stripe: "linear-gradient(90deg, #f472b6 0%, #fb7185 100%)" },
    { accent: "#2dd4bf", rowBg: "rgba(15,118,110,0.08)", chipBg: "rgba(15,118,110,0.18)", chipText: "#5eead4", stripe: "linear-gradient(90deg, #2dd4bf 0%, #5eead4 100%)" },
    { accent: "#94a3b8", rowBg: "rgba(71,85,105,0.08)", chipBg: "rgba(71,85,105,0.18)", chipText: "#cbd5e1", stripe: "linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%)" },
]

function getToneIndex(investorKey?: string | null): number {
    const value = investorKey?.trim().toLowerCase().replace(/\s+/g, " ") || "unknown-investor"
    const override = INVESTOR_TONE_OVERRIDES[value]
    if (override) {
        const idx = INVESTOR_TONES.indexOf(override as (typeof INVESTOR_TONES)[number])
        return idx >= 0 ? idx : 0
    }
    let hash = 0
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0
    }
    return hash % INVESTOR_TONES.length
}

/**
 * Returns the palette index for a given investor key.
 * Useful for consumers that need deterministic assignment.
 */
export function getInvestorToneIndex(investorKey?: string | null): number {
    return getToneIndex(investorKey)
}

/**
 * Returns investor tone with dark-appropriate colors when `isDark` is true.
 * Light mode is identical to the original `getInvestorTone`.
 * Hash, assignment, and named overrides remain exactly the same.
 */
export function getInvestorToneTheme(investorKey?: string | null, isDark = false) {
    if (!isDark) return getInvestorTone(investorKey)

    const idx = getToneIndex(investorKey)
    return {
        accent: DARK_OVERRIDES[idx].accent,
        rowBg: DARK_OVERRIDES[idx].rowBg,
        chipBg: DARK_OVERRIDES[idx].chipBg,
        chipText: DARK_OVERRIDES[idx].chipText,
        stripe: DARK_OVERRIDES[idx].stripe,
    }
}

export type { InvestorToneDark }
