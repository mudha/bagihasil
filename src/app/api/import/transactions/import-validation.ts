export type ImportNumericValue = string | number | null | undefined

export function parseImportNumber(
    value: ImportNumericValue,
    field: string,
    options: { required?: boolean; min?: number; max?: number } = {}
): number | undefined {
    const required = options.required ?? false

    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
        if (required) throw new Error(`${field} is required`)
        return undefined
    }

    const parsed = typeof value === "number" ? value : Number(value.trim())
    if (!Number.isFinite(parsed)) throw new Error(`${field} must be a finite number`)
    if (options.min !== undefined && parsed < options.min) throw new Error(`${field} is out of range`)
    if (options.max !== undefined && parsed > options.max) throw new Error(`${field} is out of range`)
    return parsed
}

export function validateImportProfitShares(
    investorSharePercentage: number,
    managerSharePercentage: number
): void {
    parseImportNumber(investorSharePercentage, "investorSharePercentage", { min: 0, max: 100 })
    parseImportNumber(managerSharePercentage, "managerSharePercentage", { min: 0, max: 100 })
    if (investorSharePercentage + managerSharePercentage !== 100) {
        throw new Error("Total nisbah investor dan pengelola harus 100%")
    }
}
