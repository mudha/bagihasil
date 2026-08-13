export function investorStatsScope(investorId: string | null) {
    return investorId ? { id: investorId } : undefined
}
