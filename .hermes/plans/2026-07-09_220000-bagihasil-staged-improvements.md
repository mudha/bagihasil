# Bagihasil Staged Improvement Plan

> **For Hermes:** Execute this plan in small phases. Every phase must pass build and targeted verification before push/deploy.

**Goal:** Membenahi aplikasi `mudha/bagihasil` sedikit demi sedikit tanpa mengganggu operasi, data finansial, login, atau deployment produksi.

**Architecture:** Perbaikan dibagi menjadi fase kecil berdasarkan risiko. Fase awal hanya quality gate dan pemeriksaan keamanan; pembaruan login/dependensi dan refactor file besar dilakukan terpisah agar mudah diuji dan di-rollback.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma/PostgreSQL, NextAuth/Auth.js, Tailwind CSS 4, Vercel.

---

## Prinsip Pelaksanaan

1. GitHub `main` adalah sumber utama.
2. Sebelum bekerja: `git fetch`, pastikan tidak ada perubahan lokal, lalu sinkronkan dari `origin/main`.
3. Satu kelompok perubahan kecil = satu commit.
4. Jangan mencampur pembaruan keamanan, refactor, dan fitur dalam satu commit/deploy.
5. Sebelum push: lint, type/build, dan smoke test alur yang terdampak.
6. Setelah Vercel deploy: cek login, dashboard, unit, transaksi, dan portal investor.
7. Jangan mengubah schema database atau perhitungan bagi hasil tanpa backup dan test khusus.

## Fase 0 — Baseline dan Jalur Rollback

**Tujuan:** Menetapkan kondisi awal yang bisa dibandingkan dan dipulihkan.

**Tindakan:**
- Catat commit produksi aktif dan status deployment Vercel.
- Pastikan environment variables produksi tersedia tanpa membaca/menampilkan nilainya.
- Dokumentasikan smoke test: login ADMIN, VIEWER, INVESTOR; buka dashboard; buka daftar unit; buka transaksi; buka portal investor.
- Buat tag baseline sebelum perubahan besar bila diperlukan.

**Verifikasi:**
- `git status --short --branch`
- `npm ci`
- `npm run build`
- Web produksi membuka `/login` dan redirect domain berjalan benar.

## Fase 1 — Quality Gate Ringan

**Tujuan:** Membuat pemeriksaan kode konsisten tanpa mengubah perilaku aplikasi.

**Files likely to change:**
- `eslint.config.mjs`
- `package.json`
- File sumber yang memiliki warning sederhana dan aman
- Opsional: `tests/` atau `vitest.config.ts` untuk test awal

**Tindakan:**
1. Bereskan error lint pada generated `next-env.d.ts` melalui konfigurasi ignore, bukan mengedit file generated.
2. Bersihkan warning aman: import/variabel tidak terpakai, `prefer-const`, dan `@ts-ignore` menjadi `@ts-expect-error` dengan alasan.
3. Tambahkan script pemeriksaan terpisah, misalnya `typecheck`, agar CI/local mudah dijalankan.
4. Jangan menjadikan seluruh 97 warning sebagai satu perubahan besar; bagi per area.

**Verifikasi:**
- `npm run lint`
- `npm run build`
- `git diff --check`

## Fase 2 — Test Pengaman Perhitungan Uang

**Tujuan:** Melindungi bagian terpenting sebelum refactor atau pembaruan dependensi.

**Files likely to change/create:**
- `src/lib/profit-sharing.ts` (ekstraksi kalkulasi murni bila diperlukan)
- `src/lib/profit-sharing.test.ts`
- `package.json`
- `src/app/api/transactions/[id]/sell/route.ts`
- `src/app/api/transactions/[id]/profit-sharing/route.ts`

**Kasus yang wajib diuji:**
- Untung dengan persentase 40/60 dan variasinya.
- Rugi dengan penanggung INVESTOR, MANAGER, dan SHARED.
- Impas.
- Investor capital berbeda dari `buyPrice`.
- Biaya investor dan pengelola dihitung tepat.
- Total persentase harus 100%.
- Transaksi selesai tidak bisa difinalisasi dua kali.

**Verifikasi:**
- Test unit seluruh kasus uang lulus.
- `npm run build` lulus.
- Bandingkan beberapa contoh transaksi produksi secara read-only.

## Fase 3 — Pembaruan Keamanan Bertahap

**Tujuan:** Mengurangi temuan high/critical tanpa merusak login atau deployment.

**Files likely to change:**
- `package.json`
- `package-lock.json`
- Mungkin `src/lib/auth.ts`, `src/lib/auth.config.ts`, `src/middleware.ts`

**Urutan:**
1. Audit versi aman yang kompatibel untuk patch/minor Next.js 15.
2. Update Next.js terlebih dahulu secara terisolasi; build dan smoke test.
3. Update `next-auth`, `@auth/core`, dan adapter secara terisolasi; uji semua role dan redirect.
4. Update dependensi transitif lain tanpa `npm audit fix --force`.
5. Jalankan `npm audit --omit=dev` ulang dan dokumentasikan temuan yang tersisa.

**Verifikasi wajib:**
- Login ADMIN, VIEWER, INVESTOR.
- Logout dan login ulang.
- Cookie/session kedaluwarsa tidak membuat redirect loop.
- Investor tidak dapat membuka area admin.
- VIEWER tidak dapat melakukan mutasi finansial.
- `npm run build` dan lint lulus.

## Fase 4 — Test Hak Akses API

**Tujuan:** Membuktikan batas akses setiap role, bukan hanya mengandalkan pemeriksaan manual.

**Area:**
- `src/lib/api-auth.ts`
- `src/middleware.ts`
- `src/app/api/transactions/**`
- `src/app/api/units/**`
- `src/app/api/investors/**`
- `src/app/api/users/**`

**Skenario:**
- Tanpa session mendapat 401.
- INVESTOR hanya melihat investor yang terhubung dengannya.
- VIEWER bisa membaca area admin yang diizinkan tetapi tidak bisa POST/PATCH/DELETE.
- ADMIN dapat melakukan mutasi.
- Parameter `investorId` dari investor tidak bisa dipakai untuk mengintip investor lain.

## Fase 5 — Performa Dashboard dan Halaman Berat

**Tujuan:** Mempercepat penggunaan di HP dan jaringan lambat tanpa mengubah fungsi.

**Target awal:**
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/transactions/page.tsx`
- `src/app/dashboard/units/page.tsx`
- `src/lib/export-utils.ts`

**Tindakan:**
1. Ukur bundle sebelum perubahan.
2. Lazy-load grafik dan utilitas export yang hanya dipakai saat diminta.
3. Hindari memuat library PDF/Excel pada first load dashboard.
4. Terapkan pagination/server filtering jika daftar transaksi/unit terlalu besar.
5. Verifikasi tampilan mobile dan waktu respons API.

**Target:**
- First Load JS dashboard turun nyata dari baseline sekitar 702 KB.
- Halaman transaksi turun dari baseline sekitar 661 KB.
- Tidak ada perubahan angka atau hak akses.

## Fase 6 — Refactor File Besar Secara Aman

**Tujuan:** Membuat perubahan fitur berikutnya lebih mudah dan minim risiko.

**Prioritas:**
1. `src/app/dashboard/units/page.tsx` (~2.084 baris)
2. `src/app/dashboard/transactions/page.tsx` (~1.942 baris)
3. `src/lib/export-utils.ts` (~1.633 baris)

**Pendekatan:**
- Ekstrak tipe, hook fetch/filter, form/dialog, tabel, dan utilitas format satu per satu.
- Jangan mengubah perilaku dan desain bersamaan dengan refactor.
- Tiap ekstraksi harus punya build/smoke test dan commit tersendiri.

## Fase 7 — Penyempurnaan UX

**Tujuan:** Membenahi masalah nyata yang dirasakan pengguna setelah fondasi aman.

**Kandidat:**
- Mobile navigation dan dialog panjang.
- Empty/loading/error state yang konsisten.
- Tombol tindakan transaksi dibuat lebih jelas dan aman dari double submit.
- Optimasi gambar dengan `next/image` atau loader ImageKit yang tepat.
- Aksesibilitas form, keyboard, label, dan kontras.

## Urutan Rekomendasi Eksekusi

1. Fase 0: baseline/rollback.
2. Fase 1: lint dan quality scripts.
3. Fase 2: test perhitungan uang.
4. Fase 3: security update.
5. Fase 4: test role/API.
6. Fase 5: performa.
7. Fase 6: refactor.
8. Fase 7: UX dan fitur tambahan berdasarkan kebutuhan nyata.

## Batasan

- Tidak memakai `npm audit fix --force` langsung.
- Tidak mengubah schema PostgreSQL pada tahap awal.
- Tidak mengubah rumus uang tanpa test dan contoh pembanding.
- Tidak push ke `main` bila build atau smoke test gagal.
- Jangan gabungkan seluruh fase dalam satu deployment.

## Definition of Done per Fase

- Diff kecil dan mudah direview.
- Tidak ada secret/data produksi masuk Git.
- Build sukses.
- Test terkait sukses.
- Deployment Vercel sukses.
- Smoke test produksi sukses.
- Tersedia commit yang mudah di-revert.
