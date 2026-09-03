/**
 * Theme-aware chart color helpers for recharts.
 *
 * All colours are resolved at call-site from the resolved `isDark` flag
 * so there are zero hydration mismatches — the caller decides when to
 * read the theme (e.g. after `useTheme().resolvedTheme` is mounted).
 */

export interface ChartColors {
    /** Primary bar / line colour */
    bar: string
    /** Secondary bar / line colour */
    barAlt: string
    /** Grid lines */
    grid: string
    /** Axis tick / label colour */
    axis: string
    /** Tooltip background (NOT the card, the crosshair cursor) */
    cursor: string
    /** Tooltip label text colour */
    tooltipLabel: string
    /** Tooltip content surface */
    tooltipBackground: string
    /** Tooltip content border */
    tooltipBorder: string
    /** Pie cell fill list (cycles) */
    pie: string[]
    /** Legend text colour */
    legendText: string
}

const LIGHT: ChartColors = {
    bar: "#0d9488",
    barAlt: "#22c55e",
    grid: "#e2e8f0",
    axis: "#64748b",
    cursor: "#ccfbf1",
    tooltipLabel: "#0f172a",
    tooltipBackground: "#ffffff",
    tooltipBorder: "#e2e8f0",
    pie: ["#0d9488", "#14b8a6", "#84cc16", "#f59e0b", "#f97316", "#64748b"],
    legendText: "#0f172a",
}

const DARK: ChartColors = {
    bar: "#2dd4bf",
    barAlt: "#4ade80",
    grid: "#1e3a37",
    axis: "#94a3b8",
    cursor: "rgba(45,212,191,0.12)",
    tooltipLabel: "#f1f5f9",
    tooltipBackground: "#10211f",
    tooltipBorder: "#29413e",
    pie: ["#2dd4bf", "#4ade80", "#a3e635", "#fbbf24", "#fb923c", "#94a3b8"],
    legendText: "#f1f5f9",
}

/**
 * Returns the correct chart palette for the current resolved theme.
 * Pass `true` when dark mode is active.
 */
export function getChartColors(isDark: boolean): ChartColors {
    return isDark ? DARK : LIGHT
}

/**
 * Preset chart fill colours (for inline `fill` props on `<Bar>`, `<Pie>`, etc.).
 */
export function chartBarFill(isDark: boolean) {
    return isDark ? "#2dd4bf" : "#0d9488"
}

export function chartBarAltFill(isDark: boolean) {
    return isDark ? "#4ade80" : "#22c55e"
}

export function chartProfitFill(isDark: boolean) {
    return isDark ? "#4ade80" : "#22c55e"
}

export function chartInvestorShareFill(isDark: boolean) {
    return isDark ? "#a3e635" : "#84cc16"
}

export function chartManagerShareFill(isDark: boolean) {
    return isDark ? "#38bdf8" : "#0ea5e9"
}

export function chartUnitsSoldFill(isDark: boolean) {
    return isDark ? "#fbbf24" : "#f59e0b"
}
