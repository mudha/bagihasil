
import { prisma } from "./prisma"

const FONNTE_TOKEN = process.env.FONNTE_TOKEN
const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || "notifications@profitsharing.com"

export async function sendWhatsApp(to: string, message: string) {
    if (!FONNTE_TOKEN) {
        console.warn("FONNTE_TOKEN not set, skipping WhatsApp notification")
        return { success: false, error: "Token not set" }
    }

    try {
        const response = await fetch("https://api.fonnte.com/send", {
            method: "POST",
            headers: {
                Authorization: FONNTE_TOKEN,
            },
            body: new URLSearchParams({
                target: to,
                message: message,
            }),
        })

        const data = await response.json()
        return { success: data.status === true, data }
    } catch (error) {
        console.error("Error sending WhatsApp:", error)
        return { success: false, error }
    }
}

export async function sendEmail(to: string, subject: string, html: string) {
    if (!RESEND_API_KEY) {
        console.warn("RESEND_API_KEY not set, skipping email notification")
        return { success: false, error: "API Key not set" }
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: EMAIL_FROM,
                to: [to],
                subject: subject,
                html: html,
            }),
        })

        const data = await response.json()
        return { success: response.ok, data }
    } catch (error) {
        console.error("Error sending email:", error)
        return { success: false, error }
    }
}

function isEmail(str: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)
}

function isPhoneNumber(str: string) {
    // Basic regex for phone numbers (start with 08, +62, 62 etc)
    return /^(\+62|62|08)[0-9]{8,15}$/.test(str.replace(/[\s-]/g, ""))
}

export async function notifyUnitSold(investorId: string, transactionId: string) {
    const investor = await prisma.investor.findUnique({
        where: { id: investorId },
        include: { user: true }
    })

    const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { unit: true }
    })

    if (!investor || !transaction) return

    const contact = investor.contactInfo || investor.user?.email
    if (!contact) return

    const unitName = transaction.unit.name
    const plateNumber = transaction.unit.plateNumber || "-"
    const message = `Halo ${investor.name}, kabar baik! Unit ${unitName} (${plateNumber}) dengan kode ${transaction.unit.code} telah TERJUAL. Rincian bagi hasil dapat dilihat di dashboard. Terima kasih!`

    if (isPhoneNumber(contact)) {
        await sendWhatsApp(contact, message)
    } else if (isEmail(contact)) {
        await sendEmail(
            contact,
            `Unit Terjual: ${unitName}`,
            `<p>Halo <strong>${investor.name}</strong>,</p>
             <p>Kabar baik! Unit <strong>${unitName}</strong> (${plateNumber}) dengan kode <strong>${transaction.unit.code}</strong> telah <strong>TERJUAL</strong>.</p>
             <p>Rincian bagi hasil dapat dilihat di dashboard.</p>
             <p>Terima kasih!</p>`
        )
    }
}

export async function notifyPaymentProof(investorId: string, transactionId: string, amount: number, proofImageUrl?: string | null) {
    const investor = await prisma.investor.findUnique({
        where: { id: investorId },
        include: { user: true }
    })

    const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { unit: true }
    })

    if (!investor || !transaction) return

    const contact = investor.contactInfo || investor.user?.email
    if (!contact) return

    const unitName = transaction.unit.name
    const formattedAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount)

    let message = `Halo ${investor.name}, bagi hasil untuk unit ${unitName} sebesar ${formattedAmount} telah ditransfer. Terima kasih!`
    if (proofImageUrl) {
        message += `\nBukti transfer: ${proofImageUrl}`
    }

    if (isPhoneNumber(contact)) {
        await sendWhatsApp(contact, message)
    } else if (isEmail(contact)) {
        await sendEmail(
            contact,
            `Bukti Transfer Bagi Hasil: ${unitName}`,
            `<p>Halo <strong>${investor.name}</strong>,</p>
             <p>Bagi hasil untuk unit <strong>${unitName}</strong> sebesar <strong>${formattedAmount}</strong> telah ditransfer.</p>
             ${proofImageUrl ? `<p>Bukti transfer dapat dilihat di sini: <a href="${proofImageUrl}">${proofImageUrl}</a></p>` : ""}
             <p>Terima kasih!</p>`
        )
    }
}
