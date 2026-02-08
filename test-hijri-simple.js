
const formatter = new Intl.DateTimeFormat('id-ID', {
    calendar: 'islamic-umalqura',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric'
});
// 2025-07-06 is around Islamic New Year 1447 (1 Muharram)
const d = new Date('2025-07-07');
const parts = formatter.formatToParts(d);
console.log('Date:', d.toISOString());
console.log('Parts:', JSON.stringify(parts, null, 2));
