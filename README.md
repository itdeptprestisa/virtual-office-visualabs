# Virtual Office

Kantor virtual 3D ala Gather/ZEP — target ~50 user bersamaan.

- `client/` — Vite + React + React Three Fiber + Rapier (physics) + Zustand + LiveKit client
- `server/` — Node + `ws` (state game, chat, akun) + token LiveKit; data di `server/data/db.json`
- `shared/` — model denah & aturan area, dipakai server dan client

## Jalankan

```bash
brew install livekit   # sekali saja — server audio/video lokal
npm install
npm run dev            # livekit (dev) + server + client
npm test               # unit + integration test
```

Buka http://localhost:5173 (atau IP LAN dari log). **Akun pertama yang mendaftar otomatis jadi admin.**
Butuh Node ≥ 20. Untuk LiveKit Cloud: salin `server/.env.example` → `server/.env`.

## Fitur

**Akun** — daftar/masuk (username + password, di-hash scrypt), sesi 30 hari, satu akun satu koneksi.
Admin bisa mewajibkan kode undangan, mengubah peran, mengeluarkan & menonaktifkan akun.
Avatar, nama, meja, chat Umum, DM, whiteboard, dan denah tersimpan permanen.
Koneksi putus → sambung ulang otomatis (posisi dipertahankan).

**Area & suara** (`shared/layout.ts` → `linkIn`):
- Area = ruangan (dinding kaca + pintu), area terbuka (Lounge, Pantry), dan tiap meja kerja.
  Satu area = langsung tersambung penuh; orang di luar area tidak ikut mendengar.
- Di luar area: radius 4 m (lingkaran di lantai), volume penuh ≤ 2 m.
- Meja: klaim → **mode fokus 🔒** (orang lain tidak bisa masuk).
- Pintu: **F** buka/tutup; orang di dalam bisa mengunci, orang luar hanya mengetuk. Kunci lepas saat ruangan kosong.
- Share screen 🖥️ hanya di dalam area; tampil di layar presentasi ruangan.

**Komunikasi** — chat **Area** (hanya yang bisa mendengar) · **Umum** · **DM**, `@username` untuk menyebut,
notifikasi suara + desktop, badge belum dibaca di judul tab.

**Anggota & status** — daftar anggota (online/offline, lokasi), status otomatis
(Tersedia / Rapat saat di ruangan atau dari kalender / Fokus / Away saat tab ditinggal) atau manual (Sibuk/Away),
📍 pergi ke dekat seseorang, 📣 panggil seseorang ke tempatmu.

**Rapat** — ✋ angkat tangan, 🔇 mute semua di ruangan, 📝 whiteboard bersama (juga tampil di dinding ruangan).

**Kalender** — tempel link iCal rahasia (Google Calendar) di Setelan → status otomatis "Rapat" saat ada acara.

**Editor denah (admin)** — 🛠️ → Edit denah: klik & seret furnitur, **R** putar, **Del** hapus, tambah furnitur,
ubah/tambah ruangan (ukuran, pintu, warna) dan area. Langsung tersimpan & terlihat semua orang.

**Kontrol** — WASD jalan (relatif kamera) · Shift lari · **C** duduk · **F** pintu · 1/2/3 emote · M mic · V kamera ·
Enter chat · drag/Q·E putar kamera · scroll zoom (dekat = third-person, jauh = dari atas).
Di HP: joystick sentuh (dorong penuh = lari).

## Belum

- Deploy online + HTTPS (kamera/mic di perangkat lain butuh HTTPS).
- Login Google & integrasi Slack (butuh domain / Slack App).
