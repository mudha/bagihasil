# Mudha Profit Sharing App

Aplikasi internal untuk mencatat unit kendaraan, transaksi jual-beli, biaya, bukti pembayaran, laporan bagi hasil, dan portal investor.

## Stack

- Next.js App Router, React, TypeScript
- NextAuth credentials login
- Prisma ORM dengan PostgreSQL
- Tailwind CSS, Radix UI, lucide-react
- ImageKit untuk upload bukti/foto
- Gemini API untuk parsing gambar
- Excel/PDF export utilities

## Menjalankan Lokal

```bash
npm install
cp .env.example .env
npm run prisma:generate:runtime
npx prisma migrate dev --schema prisma/schema.prisma
npm run prisma:generate:runtime
npm run dev
```

Selama migration ledger masih pending, jangan menjalankan `npx prisma generate` langsung. Gunakan `npm run prisma:generate:runtime` agar client aplikasi tetap kompatibel dengan database pre-migration. `prisma/schema.prisma` adalah schema canonical untuk validasi dan migration, bukan input generation runtime sementara.

Buka `http://localhost:3000`.

Seed admin lokal bila database masih kosong:

```bash
npx tsx prisma/seed.ts
```

## Environment Variables

Minimal:

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `AUTH_URL` atau `NEXTAUTH_URL`

Fitur tambahan:

- `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY`
- `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`
- `GEMINI_API_KEY`
- `FONNTE_TOKEN`
- `RESEND_API_KEY`
- `EMAIL_FROM`

## Deploy Vercel

1. Set semua environment variable di Vercel.
2. Gunakan database PostgreSQL production, bukan SQLite lokal.
3. Jalankan migration production hanya melalui prosedur resmi dan schema canonical: `npx prisma migrate deploy --schema prisma/schema.prisma`.
4. Pastikan file bukti pembayaran disimpan di ImageKit atau storage eksternal, bukan di `public/uploads`.

## Catatan Keamanan

- Jangan commit `.env`, database lokal, export data, atau file bukti pembayaran.
- API mutasi finansial dibatasi untuk role `ADMIN`.
- Role `INVESTOR` hanya boleh membaca data investor yang terhubung ke akunnya.
- Role `VIEWER` hanya untuk akses baca area admin.
