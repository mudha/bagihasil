export const getInvestorInitials = (name?: string | null) => {
    const initials = name
        ?.trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("")

    return initials || "?"
}
