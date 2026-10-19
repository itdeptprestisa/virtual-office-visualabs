# Mode tampilan 2D (bawaan) di samping 3D — rancangan

Tanggal: 2026-10-16 · Status: menunggu review

## Latar belakang & tujuan

Mode 3D berat di laptop biasa (patah-patah) dan tampilannya terasa "template": krem di mana-mana, furnitur kotak polos, dekorasi sedikit. Acuan tampilan dari user: ruang ZEP (`zep.us/play/Kw0xvm`) — 2D top-down bergaya ilustrasi, detail, avatar chibi.

Tujuan:
- Ada **dua mode tampilan: 2D dan 3D**, **2D jadi bawaan**.
- Mode 2D **ringan** (tanpa Three.js/Rapier), **tampil rapi ala ZEP** dengan palet terang (versi B yang dipilih), dan **setara fitur** dengan 3D.
- Kustomisasi avatar yang ada tetap berlaku di 2D.
- Mode 3D **tidak berubah perilakunya**.

Keputusan yang sudah disepakati:
- Gambar 2D **dibuat lewat kode (vektor, Canvas 2D)** — tanpa aset luar/lisensi.
- Palet **B (terang)**: dinding abu muda, lantai kayu terang, karpet abu muda di area kerja, kursi aksen oranye.
- Gaya avatar chibi seperti lembar avatar yang disetujui (4 arah + jalan + duduk).
- Teknologi: **Canvas 2D bawaan browser** (bukan PixiJS / bukan Three.js datar).

## Di luar cakupan (proyek lanjutan)

- Mengganti ikon emoji di UI dengan ikon asli.
- Perombakan visual mode 3D (palet & model realistis). Item dekorasi baru tampil sebagai bentuk sederhana di 3D sampai proyek ini.

## Arsitektur

```
shared/layout.ts            (tetap) denah, zona, aturan suara, COLLIDERS dipindah ke shared
client/src/controller.ts    (baru)  logika permainan tanpa React/Three — dipakai 2D & 3D
client/src/motion.ts        (baru)  antarmuka "mesin gerak" + implementasi 2D (tabrakan kotak-lingkaran)
client/src/Player.tsx       (tipis) 3D: sambungkan controller ↔ Rapier, kamera orbit, model avatar
client/src/world2d/         (baru)  renderer Canvas 2D
   view.tsx                 kanvas + loop frame + kamera 2D + overlay DOM (nama, gelembung, video)
   palette.ts               token warna palet B
   static.ts                lapisan diam per lantai (lantai, dinding, ruangan, furnitur, papan nama) di-cache
   draw/furniture.ts        fungsi gambar per ItemType (termasuk dekorasi baru)
   draw/avatar.ts           avatar chibi dari AvatarConfig (arah, jalan, duduk, emote, tangan)
   editor2d.ts              pilih/seret/putar/hapus furnitur di kanvas
client/src/graphics.ts      (ubah) view: "2d" | "3d" + kualitas 3D
client/src/App.tsx          (ubah) pilih <World2D/> atau <Scene/> (3D di-lazy-load)
```

### Controller (logika permainan bersama)

Dipindah dari `Player.tsx` tanpa mengubah perilaku: input (keyboard, joystick sentuh), arah hadap, lari, duduk/berdiri (C), emote (1/2/3), pintu (F: buka/tutup/ketuk/kunci), game terdekat, lift terdekat, ikuti orang (+ lompat bila tersangkut), teleport, dorong keluar dari meja terkunci, deteksi zona → `useNet.zoneId`, kirim posisi 15×/detik, `updateProximity` 4×/detik, animasi (`ANIM`).

Antarmuka:
```ts
interface Motion {                      // mesin gerak
  position(): [number, number, number];
  move(vx: number, vz: number, dt: number): void;   // kecepatan horizontal; mesin menangani tabrakan
  teleport(x: number, z: number): void;
}
createController(motion: Motion): { step(dt: number, now: number): FrameOut }
// FrameOut: posisi, yaw, anim, seat, dll. — dipakai renderer untuk menggambar diri sendiri.
```
Kamera bukan urusan controller. Arah input "maju" diberikan renderer (3D: yaw kamera; 2D: selalu utara = atas layar).

### Tabrakan 2D (`motion.ts`)

- Avatar = lingkaran r = 0,3 m.
- Penghalang = kotak sejajar sumbu (rotasi item kelipatan 90°): dinding luar, segmen dinding kaca (`derived.walls`), daun pintu yang tertutup, furnitur dari `COLLIDERS` (ukuran sama dengan 3D; dipindah ke `shared/` supaya dipakai keduanya).
- Gerak dipecah per sumbu (x lalu z) → avatar meluncur menyusuri dinding. Langkah dibatasi ≤ 0,2 m per sub-langkah supaya tidak menembus.
- Penghalang dihitung ulang hanya saat denah / status pintu berubah; disimpan dalam grid 2 m untuk pencarian cepat.

### Renderer 2D

- Proyeksi top-down; skala dasar 48 px/m × zoom (0,5–2,5; scroll / cubit). Kamera mengikuti avatar dengan pelembutan.
- **Lapisan diam** (offscreen canvas per lantai): lantai (ubin / karpet / warna ruangan), dinding luar tebal dengan muka depan, dinding kaca + bingkai, furnitur, tulisan nama di lantai, papan nama di atas pintu. Digambar ulang saat denah berubah atau zoom selesai berubah (supaya tajam). Hanya bagian yang terlihat di layar yang di-blit per frame.
- **Lapisan dinamis per frame**: daun pintu (animasi geser, merah saat terkunci), sorotan zona aktif, lingkaran jarak dengar, isi layar presentasi (frame video / kartu website — aturan privasi server tetap), pembatas merah meja fokus, avatar (diurut menurut z supaya yang di depan menutupi), item tinggi (tanaman, rak) bagian atasnya digambar setelah avatar yang berada di belakangnya.
- **Overlay DOM**: nama, ✋/🔊, gelembung chat, video bulat, label meja, label booking pintu — memakai komponen & kelas CSS yang sama dengan 3D, diposisikan dengan `transform` tiap frame.
- Avatar orang lain: interpolasi posisi sama dengan `RemotePlayer` (INTERP_DELAY 120 ms); arah hadap 4 arah dari yaw.

### Palet B (token)

| Token | Nilai | Pakai |
|---|---|---|
| floor | `#d9c6a8` / garis `#cdb894` | lantai kayu (lorong, fasilitas) |
| carpet | `#cfd4da` / garis `#c4c9d0` | area kerja divisi |
| roomTint | warna ruangan dicampur 80% putih | lantai ruangan |
| wallTop / wallFace / wallEdge | `#c4c9d1` / `#dde1e6` / `#a9afb8` | dinding luar tebal |
| glass / frame | `rgba(150,200,235,.55)` / `#9aa1ab` | dinding kaca |
| table | `#ffffff` | meja rapat / makan |
| chair / chairDark | `#e07a5f` / `#b85a42` | kursi aksen |
| deskTop / deskEdge | `#e6cfae` / `#c2a37c` | meja kerja |
| task | `#4a4f5a` | kursi kerja |
| bg | `#e9ecef` | di luar gedung |

### Dekorasi baru (ItemType, dipakai 2D & 3D)

`clock` (jam dinding), `dispenser` (dispenser air), `frame` (bingkai foto/lukisan), `floorLamp`, `printer`, `bin` (tempat sampah), `magazineRack`, `window` (jendela di dinding luar). Ditambahkan ke `ITEM_TYPES`/`ITEM_LABELS` (+ terjemahan EN), collider untuk yang padat, gambar 2D lengkap, bentuk 3D sederhana. Ditempatkan di denah bawaan: jam & bingkai di tiap divisi/ruang rapat, dispenser & tempat sampah di tiap divisi, printer di lorong tengah, jendela di dinding luar, lampu lantai di ruang CEO/COO & lounge, rak majalah di lounge & resepsionis.

### Ganti mode

- `graphics.ts`: `view: "2d" | "3d"` (bawaan `"2d"`, disimpan `localStorage` dengan try/catch) + `quality` 3D yang sudah ada.
- HUD: pill **"Tampilan: 2D / 3D"** menggantikan pill "Grafik"; pilihan kualitas 3D (Tinggi/Ringan/2.5D) pindah ke Pengaturan, tampil hanya di mode 3D.
- Pindah mode: koneksi server & LiveKit tetap; posisi diteruskan ke mesin gerak mode baru (`teleport`).
- `Scene` (3D) dimuat lazy (`React.lazy`) → Three.js & Rapier tidak diunduh selama di 2D.

## Penanganan galat

- Kanvas 2D gagal dibuat (sangat jarang) → tampilkan pesan dan tawarkan mode 3D.
- Teks/tekstur gagal (font belum siap) → lapisan diam digambar ulang setelah `document.fonts.ready`.
- `localStorage` tak tersedia → pakai bawaan 2D tanpa menyimpan.

## Pengujian

- **Unit**: tabrakan 2D (tak tembus dinding kaca/luar, meluncur menyusuri dinding, pintu tertutup menghalangi, celah pintu terbuka bisa dilewati, furnitur menghalangi, kursi tidak); controller (input → kecepatan, duduk/berdiri, pintu F, dorong keluar meja fokus, kirim posisi berkala) memakai mesin gerak tiruan.
- **Regresi 3D**: semua test yang ada tetap lulus; e2e 3D tetap lulus.
- **E2E 2D**: daftar → masuk (bawaan 2D) → chat/DM → lift ke Lantai 2 → game → kembali → panggung town hall; tanpa error JS; ganti ke 3D lalu kembali ke 2D.
- **Performa**: alat ukur yang sama (waktu masuk, FPS di headless) — target waktu masuk 2D jauh di bawah 3D dan FPS 2D ≥ 3× mode 2.5D.

## Urutan pengerjaan

1. `controller.ts` + test; `Player.tsx` memakainya — 3D identik.
2. `motion.ts` (tabrakan 2D) + test; `COLLIDERS` pindah ke `shared/`.
3. Renderer 2D: lapisan diam (lantai, dinding, ruangan, furnitur, papan nama).
4. Avatar 2D, gerak, kamera, overlay DOM.
5. Interaksi setara 3D (daftar di bagian Renderer & Controller).
6. Editor denah 2D.
7. Dekorasi baru + penempatan di denah bawaan.
8. Ganti mode + bawaan 2D + lazy 3D + e2e kedua mode + ukur performa.
