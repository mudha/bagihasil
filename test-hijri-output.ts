
import { formatHijri } from "./src/lib/date-utils"

const dates = [
    '2025-07-06', // Muharram
    '2025-08-01', // Safar
    '2025-09-01', // Rabiul Awal
    '2025-10-01', // Rabiul Akhir
    '2025-11-01', // Jumadil Awal
    '2025-12-01', // Jumadil Akhir
    '2026-01-01', // Rajab
    '2026-02-01', // Syakban
    '2026-03-01', // Ramadan
    '2026-04-01', // Syawal
    '2026-05-01', // Zulkaidah
    '2026-06-01', // Zulhijah
]

dates.forEach(d => {
    console.log(`${d}: ${formatHijri(d)}`)
})
