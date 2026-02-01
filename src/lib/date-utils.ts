export function formatHijri(date: Date | string): string {
    const d = new Date(date)
    return new Intl.DateTimeFormat('id-ID', {
        calendar: 'islamic-umalqura',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(d)
}

export function formatHijriFull(date: Date | string): string {
    const d = new Date(date)
    const masehi = new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(d)

    const hijri = formatHijri(d)
    return `${masehi} (${hijri} H)`
}

export function getHijriMonthYear(date: Date): { month: string, year: string, key: string } {
    const formatter = new Intl.DateTimeFormat('id-ID', {
        calendar: 'islamic-umalqura',
        month: 'long',
        year: 'numeric'
    })

    // Format parts to extract month and year reliably
    const parts = formatter.formatToParts(date)
    const month = parts.find(p => p.type === 'month')?.value || ''
    const year = parts.find(p => p.type === 'year')?.value || ''

    return {
        month,
        year,
        key: `${month} ${year}`
    }
}
