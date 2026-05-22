# Project Requirements Document (PRD)
# Aplikasi Manajemen Bagi Hasil Kendaraan

**Versi:** 1.0  
**Tanggal:** 25 Maret 2026  
**Status:** Live / Production  

---

## 1. Latar Belakang & Tujuan

### 1.1 Latar Belakang
Aplikasi ini dibangun untuk mengelola bisnis jual-beli kendaraan bermotor (mobil & motor) yang dijalankan dengan **sistem bagi hasil (mudharabah/profit-sharing)** antara **Pemodal** (penyedia modal) dan **Pengelola** (operator bisnis).

Sebelum adanya aplikasi ini, proses pencatatan dilakukan secara manual sehingga rentan terhadap kesalahan perhitungan bagi hasil, pencatatan bukti transfer, dan pelaporan kepada pemodal.

### 1.2 Tujuan
1. Menyediakan platform terpusat untuk mencatat setiap transaksi pembelian dan penjualan unit kendaraan.
2. Menghitung bagi hasil secara otomatis berdasarkan persentase yang telah disepakati per pemodal.
3. Memberikan transparansi kepada pemodal melalui portal investor mandiri.
4. Mempermudah proses pelaporan keuangan dalam format PDF dan Excel.
5. Mengintegrasikan AI untuk mempercepat entri data dari bukti transfer dan dokumen kendaraan (STNK).

---

## 2. Pengguna (User Roles)

| Role | Deskripsi | Akses |
|------|-----------|-------|
| **ADMIN** | Pengelola bisnis, punya akses penuh | Semua fitur CRUD, laporan, manajemen user |
| **VIEWER** | Staf internal dengan akses baca saja | Melihat semua data, tidak bisa edit/hapus |
| **INVESTOR** | Pemodal, hanya melihat data miliknya sendiri | Portal investor: unit & transaksi miliknya saja |

---

## 3. Modul & Fitur

### 3.1 Autentikasi & Otorisasi
- Login dengan username & password (berbasis NextAuth.js)
- Session berbasis JWT
- Proteksi route via middleware:
  - INVESTOR → diarahkan ke `/dashboard/investor`
  - ADMIN/VIEWER → diarahkan ke `/dashboard`
  - Unauthenticated → diarahkan ke `/login`

---

### 3.2 Dashboard (Ringkasan Eksekutif)

**Tampilan:**
- Kartu statistik utama:
  - Total Unit Aktif (link ke daftar unit AVAILABLE)
  - Modal yang Sedang Diputar (Rp)
  - Total Unit Terjual (link ke transaksi COMPLETED)
  - Total Margin (keuntungan bersih kumulatif)
  - Total Bagi Hasil Pemodal (kumulatif)
  - Total Bagi Hasil Pengelola (kumulatif)

**Filter:**
- Filter per Pemodal (dropdown)
- Toggle kalender: **Masehi** / **Hijri**
- Rentang waktu: 6 bulan, 1 tahun, 2 tahun

**Grafik (Bar Chart):**
1. Total Omset Bulanan
2. Total Profit Bulanan
3. Pembagian Profit (stacked: Pemodal vs Pengelola)
4. Unit Terjual per Bulan

**Widget lainnya:**
- **Aktivitas Terbaru** — 5-10 transaksi terakhir
- **Performa Pemodal** — Profit per investor
- **Pengingat Pajak Kendaraan** — unit yang pajak STNK-nya hampir/sudah jatuh tempo (badge merah jika ≤ 7 hari)

**Ekspor:**
- Ekspor laporan per pemodal ke **PDF** atau **Excel (XLSX)**

---

### 3.3 Manajemen Unit Kendaraan

**Data Unit:**
| Field | Keterangan |
|-------|-----------|
| Kode Unit | Kode unik otomatis per pemodal |
| Nama Unit | Di-generate otomatis dari: Merek + Model + Tahun + Warna |
| Nomor Polisi | Wajib diisi |
| Pemodal | Relasi ke data pemodal |
| Status | AVAILABLE / SOLD / MAINTENANCE |
| Jenis Kendaraan | Mobil / Motor |
| Merek | Toyota, Yamaha, Honda, dll (dropdown) |
| Model | Avanza, NMAX, Beat, dll (dropdown per merek) |
| Tahun | Dropdown 30 tahun terakhir |
| Warna | Dropdown warna standar |
| Foto Unit | Upload gambar unit |
| STNK | Upload gambar STNK |
| Masa Pajak | Tanggal jatuh tempo pajak (date picker) |
| No. Mesin | Nomor mesin kendaraan |
| No. Rangka | Nomor rangka kendaraan |

**Fitur Khusus Unit:**
- **AI Scan STNK**: Upload foto STNK → AI (Gemini) mengekstrak data secara otomatis (nomor polisi, masa pajak, nomor mesin, nomor rangka, warna, jenis, merek, model, tahun)
- **Deteksi Unit Duplikat (Buyback)**: Jika nomor polisi sudah pernah ada, sistem menampilkan badge "Pembelian ke-X" untuk membedakan riwayat pembelian ulang kendaraan yang sama
- **Status Pajak Visual**: Indikator warna di tabel:
  - 🟢 Hijau: > 3 bulan lagi
  - 🟡 Kuning: ≤ 3 bulan atau di bulan yang sama
  - 🔴 Merah: Sudah lewat jatuh tempo

**Manajemen:**
- CRUD Unit (Tambah, Edit, Hapus)
- Filter: per status, per pemodal (aktif/nonaktif), per pencarian teks
- Sorting: kode, nama, investor, status, tanggal dibuat
- Pagination (10 item/halaman)
- Import massal via Excel (XLSX)
- **Tampilan responsif**: Card view di mobile, Table view di desktop

---

### 3.4 Manajemen Transaksi

Setiap transaksi merepresentasikan satu siklus hidup unit: **Beli → (Biaya Operasional) → Jual → Bagi Hasil**.

**Data Transaksi:**
| Field | Keterangan |
|-------|-----------|
| Kode Transaksi | Kode unik (auto-generate, dapat disambung dengan kode unit) |
| Unit | Relasi ke unit kendaraan |
| Tanggal Beli | Wajib |
| Harga Beli | Wajib |
| Modal Awal Pemodal | Modal yang disetorkan pemodal |
| Modal Awal Pengelola | Kontribusi modal pengelola (opsional) |
| Catatan | Catatan bebas |
| Bukti Beli | Upload gambar bukti transfer pembelian |
| Status | ACTIVE / COMPLETED |
| Tanggal Jual | Diisi saat unit terjual |
| Harga Jual | Diisi saat unit terjual |
| Bukti Jual | Upload gambar bukti transfer penjualan |

**Sub-entitas per Transaksi:**

#### a. Biaya Operasional (Costs)
Biaya-biaya yang dikeluarkan selama unit dipegang (bensin, servis, iklan, dll).

| Field | Keterangan |
|-------|-----------|
| Nominal | Jumlah biaya |
| Deskripsi | Keterangan biaya |
| Tanggal | Tanggal biaya |
| Jenis Biaya | TRANSPORT, GAS, MEAL, TOLL, PARKING, REPAIR, INSPECTION, ADS, STAMP_DUTY, BROKER, SALES, OTHER |
| Bukti | Upload gambar struk/nota |
| AI Scan | Bisa di-scan pakai AI untuk mengisi nominal, tanggal, dan jenis biaya otomatis |

#### b. Riwayat Pembayaran Bagi Hasil (Payment Histories)
Catatan pembayaran bagi hasil yang sudah ditransfer ke pemodal.

| Field | Keterangan |
|-------|-----------|
| Jumlah | Nominal yang ditransfer |
| Tanggal Pembayaran | Tanggal transfer |
| Metode | TRANSFER / CASH |
| Catatan | Diambil dari catatan transfer di bukti (via AI) |
| Bukti Transfer | Upload/paste gambar bukti transfer |
| AI Scan | Mengekstrak nominal dan catatan dari gambar bukti transfer |

#### c. Profit Sharing (Kalkulasi Bagi Hasil)
Kalkulasi otomatis:
- **Margin Kotor** = Harga Jual − Harga Beli − Total Biaya Operasional
- **Bagi Hasil Pemodal** = Margin × (% Pemodal)
- **Bagi Hasil Pengelola** = Margin × (% Pengelola)
- Rekap total yang sudah dibayarkan vs. sisa yang belum dibayarkan

**Fitur Transaksi:**
- AI Scan bukti beli: mengisi nominal dan tanggal otomatis
- Filter: per status, per pemodal (aktif/nonaktif), per investor, pencarian teks
- Sorting: kode transaksi, tanggal beli, tanggal jual, harga beli, harga jual, status, investor, durasi, status bayar
- Pagination (10 item/halaman)
- Bulk action: Hapus massal, set Lunas massal
- Import massal via Excel (XLSX) dengan template
- Ekspor laporan PDF per transaksi
- Indikator status pembayaran bagi hasil: **Lunas** / **Belum Bayar**
- Halaman detail transaksi dengan semua informasi lengkap
- Edit detail transaksi langsung dari halaman detail

---

### 3.5 Manajemen Pemodal (Investors)

**Data Pemodal:**
| Field | Keterangan |
|-------|-----------|
| Nama | Nama lengkap pemodal |
| Kontak | Nomor HP / Email |
| Info Rekening | Nomor rekening bank |
| Catatan | Catatan bebas |
| Persentase Margin | % bagi hasil untuk pemodal (0–100) |
| Status Aktif | Aktif / Nonaktif (toggle switch) |
| Akun Login | Bisa dihubungkan ke akun user dengan role INVESTOR |

**Fitur Pemodal:**
- CRUD Pemodal
- Toggle aktif/nonaktif (soft disable)
- Ekspor laporan per pemodal ke **PDF** atau **Excel (XLSX)**
- Hubungkan ke akun user INVESTOR untuk akses portal

---

### 3.6 Portal Investor (Dashboard Investor)

Halaman khusus untuk pengguna dengan role **INVESTOR**, hanya menampilkan data milik investor tersebut.

**Konten:**
- Ringkasan: Total Unit Aktif, Total Unit Terjual, Total Profit, Total Bagi Hasil Diterima
- Daftar unit miliknya (dengan status pajak)
- Daftar transaksi (dengan detail biaya & pembayaran)
- Riwayat pembayaran bagi hasil yang sudah diterima

---

### 3.7 Kalkulator Estimasi Profit

Halaman standalone untuk simulasi keuntungan sebelum memutuskan membeli unit.

**Input:**
- Harga Beli Unit
- Estimasi Biaya Perbaikan
- Biaya Lainnya
- Target Harga Jual
- Slider: Persentase Bagi Hasil Pemodal (0–100%)

**Output (real-time):**
- Total Modal
- Estimasi Profit Bersih (Harga Jual − Total Modal)
- ROI (%)
- Estimasi Bagian Pemodal (Rp)
- Estimasi Bagian Pengelola (Rp)
- Peringatan merah jika terjadi kerugian

---

### 3.8 Log Aktivitas

Halaman untuk melihat riwayat perubahan data di sistem (audit trail).

---

### 3.9 Manajemen Pengguna

- Khusus ADMIN
- CRUD pengguna aplikasi
- Assign role: ADMIN / VIEWER / INVESTOR

---

## 4. Fitur AI (Kecerdasan Buatan)

Semua fitur AI menggunakan **Google Gemini API** dengan fallback model otomatis:
1. `gemini-2.5-flash` → 2. `gemini-2.0-flash` → 3. `gemini-flash-latest`

| Fitur | Trigger | Output |
|-------|---------|--------|
| **Scan Bukti Transfer (Pembelian)** | Upload gambar saat buat transaksi baru | Nominal beli, tanggal |
| **Scan Bukti Transfer (Bagi Hasil)** | Upload/paste gambar di dialog Tambah Pembayaran | Nominal, catatan transfer mentah dari receipt |
| **Scan Struk Biaya** | Upload struk/nota di dialog Tambah Biaya | Nominal, tanggal, jenis biaya otomatis |
| **Scan STNK** | Upload foto STNK di form unit | Nomor polisi, masa pajak, merek, model, warna, tahun, nomor mesin, nomor rangka |

**Catatan parsing AI untuk bukti bagi hasil:**
- AI mengekstrak catatan/pesan transfer **secara mentah** tanpa format tambahan
- Tidak menyertakan tanggal atau awalan seperti "Transfer 1:" di kolom keterangan

---

## 5. Fitur Ekspor & Laporan

| Jenis Laporan | Format | Konten |
|---------------|--------|--------|
| Laporan Investor | PDF | Profil investor, daftar transaksi, total modal, total profit, total bagi hasil |
| Laporan Investor | XLSX (Excel) | Sheet: ringkasan, detail transaksi per unit |
| Laporan Transaksi | PDF | Detail satu transaksi: unit info, biaya operasional, riwayat pembayaran, kalkulasi bagi hasil |

---

## 6. Import Data

- **Import Unit**: Template Excel dapat diunduh, kolom: nama, nomor polisi, kode, investor, dsb.
- **Import Transaksi**: Template Excel untuk import massal riwayat transaksi lama.

---

## 7. Arsitektur Teknis

### 7.1 Stack Teknologi

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React, TypeScript |
| Backend/API | Next.js API Routes (server-side) |
| Database | PostgreSQL (via Neon — cloud serverless) |
| ORM | Prisma |
| Auth | NextAuth.js (Credentials Provider) |
| AI | Google Gemini API (`@google/generative-ai`) |
| UI Components | shadcn/ui + Tailwind CSS |
| Charts | Recharts |
| Form Validation | React Hook Form + Zod |
| Export | ExcelJS (XLSX), jsPDF + html2canvas (PDF) |
| File Upload | Vercel Blob Storage |
| Hosting | Vercel |
| Version Control | GitHub |

### 7.2 Struktur Direktori Utama

```
src/
├── app/
│   ├── api/                    # Backend API Routes
│   │   ├── ai/
│   │   │   ├── parse-receipt/  # AI scan bukti transfer & struk biaya
│   │   │   └── parse-stnk/     # AI scan STNK
│   │   ├── auth/               # NextAuth auth routes
│   │   ├── dashboard/          # API data dashboard
│   │   ├── investors/          # CRUD Pemodal
│   │   ├── transactions/
│   │   │   └── [id]/
│   │   │       ├── costs/      # Biaya operasional
│   │   │       ├── payments/   # Riwayat pembayaran bagi hasil
│   │   │       ├── profit-sharing/ # Kalkulasi bagi hasil
│   │   │       └── sell/       # Update status jual
│   │   ├── units/              # CRUD Unit kendaraan
│   │   ├── upload/             # Upload file ke Blob Storage
│   │   ├── users/              # Manajemen pengguna
│   │   ├── reports/            # Generate laporan
│   │   └── import/             # Import data dari Excel
│   └── dashboard/              # Halaman-halaman frontend
│       ├── page.tsx            # Dashboard utama
│       ├── units/              # Manajemen unit
│       ├── transactions/       # Manajemen transaksi
│       ├── investors/          # Manajemen pemodal
│       ├── investor/           # Portal investor (read-only)
│       ├── calculator/         # Kalkulator profit
│       ├── activity-logs/      # Log aktivitas
│       └── users/              # Manajemen user
├── components/                 # Reusable UI components
├── lib/                        # Utilities
│   ├── gemini.ts               # Integrasi Google Gemini API
│   ├── auth.ts / auth.config.ts # Konfigurasi NextAuth
│   ├── export-utils.ts         # PDF & XLSX export
│   ├── date-utils.ts           # Konversi Masehi ↔ Hijri
│   └── image-utils.ts          # Validasi & kompresi gambar
└── middleware.ts               # Route protection & redirection
```

---

## 8. Model Data (Ringkasan)

### Investor
```
id, name, contactInfo, bankAccountDetails, notes,
marginPercentage (0-100), isActive, userId (FK ke User)
```

### Unit
```
id, code, name, plateNumber, status (AVAILABLE/SOLD/MAINTENANCE),
investorId (FK), imageUrl, taxDueDate,
vehicleType, brand, model, year, color,
stnkImageUrl, engineNumber, chassisNumber
```

### Transaction
```
id, transactionCode, unitId (FK), status (ACTIVE/COMPLETED),
buyDate, buyPrice, initialInvestorCapital, initialManagerCapital,
sellDate, sellPrice, notes, buyProofImageUrl, sellProofImageUrl
```

### TransactionCost (Biaya Operasional)
```
id, transactionId (FK), amount, description, date,
costType (enum), proofImageUrl
```

### PaymentHistory (Riwayat Bagi Hasil)
```
id, transactionId (FK), amount, paymentDate,
method (TRANSFER/CASH), notes, proofImageUrl
```

### User
```
id, name, email, password (hashed), role (ADMIN/VIEWER/INVESTOR)
```

---

## 9. API Endpoints Utama

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| GET/POST | `/api/investors` | List & tambah pemodal |
| PUT/DELETE | `/api/investors/[id]` | Edit & hapus pemodal |
| GET/POST | `/api/units` | List & tambah unit |
| PUT/DELETE | `/api/units/[id]` | Edit & hapus unit |
| GET/POST | `/api/transactions` | List & tambah transaksi |
| GET/PUT/DELETE | `/api/transactions/[id]` | Detail, edit, hapus transaksi |
| PUT | `/api/transactions/[id]/sell` | Update status jual |
| GET/POST | `/api/transactions/[id]/costs` | List & tambah biaya |
| PUT/DELETE | `/api/transactions/[id]/costs/[costId]` | Edit & hapus biaya |
| GET/POST | `/api/transactions/[id]/payments` | List & tambah pembayaran bagi hasil |
| GET | `/api/transactions/[id]/profit-sharing` | Kalkulasi bagi hasil |
| POST | `/api/ai/parse-receipt` | AI scan bukti transfer/struk |
| POST | `/api/ai/parse-stnk` | AI scan STNK |
| POST | `/api/upload/payment-proof` | Upload gambar ke Blob Storage |
| GET | `/api/dashboard` | Data untuk dashboard (dengan filter) |
| GET | `/api/reports/investor` | Generate laporan investor |
| POST | `/api/import/transactions` | Import massal transaksi dari Excel |
| POST | `/api/import/units` | Import massal unit dari Excel |

---

## 10. Keamanan & Non-Functional Requirements

- **Autentikasi**: Semua route dashboard & API dilindungi NextAuth session
- **Otorisasi berbasis role**: Middleware mengontrol akses berdasarkan role
- **VIEWER read-only**: Semua tombol edit/hapus disembunyikan untuk role VIEWER
- **INVESTOR isolation**: INVESTOR hanya bisa melihat data miliknya sendiri
- **File Validation**: Upload gambar dibatasi tipe (JPG/PNG) dan ukuran (max 5MB)
- **AI Timeout**: Request ke Gemini API dibatasi maksimal 55 detik, dengan fallback ke model lain
- **Kompresi Gambar**: Gambar dikompresi sebelum upload untuk efisiensi storage

---

## 11. Batasan & Asumsi

1. Aplikasi ini ditujukan untuk **satu entitas bisnis** (satu pengelola, banyak pemodal)
2. Mata uang yang digunakan: **IDR (Rupiah)** tanpa desimal
3. Perhitungan bagi hasil hanya berdasarkan **margin (profit)**, bukan dari pendapatan kotor
4. Integrasi kalender Hijri bersifat tampilan saja (tidak mengubah data di database)
5. Tidak ada notifikasi otomatis (reminder pajak hanya tampil di dashboard)

---

*Dokumen ini di-generate berdasarkan analisis kode sumber aplikasi yang sedang berjalan di production.*
