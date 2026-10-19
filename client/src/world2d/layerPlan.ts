// Perhitungan murni untuk lapisan diam & kamera 2D (tanpa DOM, supaya bisa dites).
import { WORLD } from "../../../shared/layout";
import { WORLD_H, WORLD_W, ppm, viewRect, type Cam } from "./camera";

/** Batas luas kanvas lapisan diam (piksel) — jauh di bawah batas iOS Safari (16,7 jt) dan hemat memori. */
export const MAX_LAYER_PIXELS = 8_000_000;
const MARGIN = 0.25; // cadangan geser di tiap sisi: seperempat sisi layar terpanjang
const ZOOM_SETTLE_MS = 150; // selama zoom masih berubah, lapisan lama cukup diskalakan
const SNAP_DIST = 5; // lompatan kamera lebih jauh dari ini (teleport, lift) langsung loncat

/** Area (meter) yang digambar ke lapisan diam dan skalanya (piksel kanvas per meter). */
export function planLayer(cam: Cam, dpr: number) {
  const rect = viewRect(cam, (Math.max(cam.w, cam.h) * MARGIN) / ppm(cam));
  const area = (rect.x1 - rect.x0) * (rect.z1 - rect.z0);
  // Sedikit di bawah batas supaya pembulatan ke atas ukuran kanvas tetap aman.
  const scale = Math.min(ppm(cam) * dpr, Math.sqrt((MAX_LAYER_PIXELS * 0.98) / area));
  return { rect, scale };
}

/** Perlu menggambar ulang lapisan diam sekarang? */
export function shouldRedraw(s: { dirty: boolean; inside: boolean; keyChanged: boolean; scaleChanged: boolean; sinceScaleChange: number }) {
  return s.dirty || !s.inside || s.keyChanged || (s.scaleChanged && s.sinceScaleChange >= ZOOM_SETTLE_MS);
}

/**
 * Seberapa jauh kamera bergeser dari avatar ke tengah gedung pada satu sumbu: 0 selama layar menampung < 60% gedung
 * (mengikuti avatar seperti biasa), naik mulus sampai 1 saat gedung muat seluruhnya (zoom paling jauh = lihat semua).
 */
export function overviewBlend(viewSize: number, worldSize: number) {
  const t = Math.min(1, Math.max(0, (viewSize / worldSize - 0.6) / 0.4));
  return t * t * (3 - 2 * t);
}

/** Kamera menyusul avatar dengan halus; lompatan jauh langsung loncat (supaya lapisan diam tidak digambar ulang berkali-kali). */
export function followCam(c: Cam, px: number, pz: number, dt: number) {
  const bx = overviewBlend(c.w / ppm(c), WORLD_W);
  const bz = overviewBlend(c.h / ppm(c), WORLD_H);
  const x = px + ((WORLD.minX + WORLD.maxX) / 2 - px) * bx;
  const z = pz + ((WORLD.minZ + WORLD.maxZ) / 2 - pz) * bz;
  if (Math.hypot(x - c.x, z - c.z) > SNAP_DIST) {
    c.x = x;
    c.z = z;
    return;
  }
  const k = 1 - Math.exp(-8 * dt);
  c.x += (x - c.x) * k;
  c.z += (z - c.z) * k;
}
