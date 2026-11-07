# Pengembangan Lokal (aman untuk data produksi)

Alur kerja: **lokal -> preview Vercel -> production**. Perubahan dicoba dulu di komputer sendiri
dengan database lokal yang terpisah. Baru setelah OK di-push ke Vercel.

## Aturan utama
1. `.env.local` **tidak boleh** berisi URL database produksi.
2. `npm run dev` otomatis menolak jalan bila `DATABASE_URL`/`DIRECT_URL` bukan host lokal
   (`scripts/assert-local-database.ts`).
3. Database lokal harus **meniru kondisi produksi saat ini**: hanya migrasi baseline.
   Migrasi `20260830222005_loss_capital_ledger_foundation` masih *pending* di produksi,
   jadi **jangan** diterapkan di lokal dulu. Lihat catatan di README tentang migration ledger.

## Setup pertama kali
Butuh: Node.js, Docker.

```bash
npm install
cp .env.local.example .env.local
docker compose -f docker-compose.local.yml up -d
```

Buat tabel dari migrasi baseline saja (sama dengan produksi saat ini):

```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260824000000_postgresql_baseline/migration.sql
npm run prisma:generate:runtime
```

Isi akun admin dummy, lalu jalankan:

```bash
npx tsx prisma/seed.ts
npm run dev
```

Buka http://localhost:3000. Login seed: `admin@example.com` / `password123` (hanya untuk lokal).

> Jangan jalankan `npx prisma generate` langsung. Pakai `npm run prisma:generate:runtime`
> (lihat README).

## Alur setiap revisi
1. Claude mengerjakan di branch dan menjalankan test (`npm test`, `npm run typecheck`, `npm run lint`).
2. Anda: `git pull`, lalu `npm run dev` dan coba di localhost.
3. Jika OK: push ke branch, Vercel membuat **preview URL**. Coba sekali lagi di sana.
4. Jika OK: merge ke `main` (production).
5. Revisi yang menyentuh `prisma/` atau perhitungan uang **selalu ditandai** dan tidak ikut
   otomatis. Migrasi produksi dijalankan terpisah dan sadar (lihat
   `docs/database/postgresql/*runbook*.md`).

## Reset database lokal
```bash
docker compose -f docker-compose.local.yml down -v
```
Lalu ulangi langkah setup.

## Data uji yang mirip aslinya
Gunakan `scripts/export-data.ts` dan `scripts/import-data.ts`. Samarkan nama dan nominal
sebelum dipakai di lokal. Jangan membawa data asli investor ke komputer yang tidak aman.
