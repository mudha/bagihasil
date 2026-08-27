import { differenceInCalendarMonths, differenceInDays } from "date-fns"

export interface TaxStatus {
    text: string
    color: string
}

export const getTaxStatus = (dateInput: Date | string): TaxStatus => {
    const taxDate = new Date(dateInput)
    const now = new Date()
    // Reset time components for accurate date comparisons
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const targetDate = new Date(taxDate.getFullYear(), taxDate.getMonth(), taxDate.getDate())

    const monthsDiff = differenceInCalendarMonths(targetDate, today)

    const formatMonths = (totalMonths: number) => {
        const years = Math.floor(totalMonths / 12)
        const months = totalMonths % 12

        if (years === 0) {
            return `${months} bulan`
        } else if (months === 0) {
            return `${years} tahun`
        } else {
            return `${years} tahun ${months} bulan`
        }
    }

    if (monthsDiff < 0) {
        const monthsOverdue = Math.abs(monthsDiff)
        return {
            text: `Mati ${formatMonths(monthsOverdue)}`,
            color: "text-red-600"
        }
    } else if (monthsDiff === 0) {
        const daysDiff = differenceInDays(targetDate, today)

        if (daysDiff < 0) {
            const daysOverdue = Math.abs(daysDiff)
            return {
                text: `Mati kelewat ${daysOverdue} hari`,
                color: "text-red-600"
            }
        } else if (daysDiff === 0) {
            return {
                text: "Hari ini jatuh tempo",
                color: "text-amber-600"
            }
        } else {
            return {
                text: `Kurang ${daysDiff} hari lagi`,
                color: "text-amber-600"
            }
        }
    } else if (monthsDiff <= 3) {
        return {
            text: `Kurang ${monthsDiff} bulan lagi`,
            color: "text-amber-600"
        }
    } else {
        return {
            text: `Kurang ${formatMonths(monthsDiff)} lagi`,
            color: "text-green-600"
        }
    }
}
