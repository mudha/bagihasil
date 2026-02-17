const HIJRI_MONTHS = [
    'Muharam',
    'Safar',
    'Rabiulawal',
    'Rabiulakhir',
    'Jumadilawal',
    'Jumadilakhir',
    'Rajab',
    'Syakban',
    'Ramadan',
    'Syawal',
    'Zulkaidah',
    'Zulhijah'
]

const TIMEZONE = 'Asia/Jakarta'

export function formatHijri(date: Date | string): string {
    const d = new Date(date)
    // Get numeric values for day, month, year in Islamic calendar
    const formatter = new Intl.DateTimeFormat('id-ID', {
        calendar: 'islamic-umalqura',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        timeZone: TIMEZONE
    })

    const parts = formatter.formatToParts(d)
    const day = parts.find(p => p.type === 'day')?.value
    const monthIndex = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1
    const year = parts.find(p => p.type === 'year')?.value

    const monthName = HIJRI_MONTHS[monthIndex] || ''

    return `${day} ${monthName} ${year}`
}

export function formatHijriFull(date: Date | string): string {
    const d = new Date(date)
    const masehi = new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: TIMEZONE
    }).format(d)

    const hijri = formatHijri(d)
    return `${masehi} (${hijri} H)`
}

export function getHijriMonthYear(date: Date): { month: string, year: string, key: string } {
    const formatter = new Intl.DateTimeFormat('id-ID', {
        calendar: 'islamic-umalqura',
        month: 'numeric',
        year: 'numeric',
        timeZone: TIMEZONE
    })

    const parts = formatter.formatToParts(date)
    const monthIndex = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1
    const year = parts.find(p => p.type === 'year')?.value || ''
    const month = HIJRI_MONTHS[monthIndex] || ''

    return {
        month,
        year,
        key: `${month} ${year}`
    }
}
