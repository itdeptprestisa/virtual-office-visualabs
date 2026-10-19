// Aksi dari luar renderer (tombol HUD, panggil/cari orang, server) → controller yang sedang aktif (2D atau 3D).
import type { Controller } from "./controller";
import { changeFloor, selfPos, useNet } from "./net";
import { zoneAt } from "./zones";
import { useGraphics, type View } from "./graphics";

let active: Controller | null = null;

/** Dipanggil renderer saat controller-nya siap; hasilnya untuk melepas. */
export function setActiveController(c: Controller) {
  active = c;
  // Hook debug untuk tes otomatis (hanya mode dev): ada = avatar siap digerakkan.
  if (import.meta.env?.DEV) {
    const vo = (window as unknown as { __vo?: Record<string, unknown> }).__vo;
    if (vo) vo.teleport = teleportTo;
  }
  return () => {
    if (active !== c) return;
    active = null;
    if (import.meta.env?.DEV) {
      const vo = (window as unknown as { __vo?: Record<string, unknown> }).__vo;
      if (vo) delete vo.teleport;
    }
  };
}

/** Pindah ke (x, z). Bila belum ada renderer aktif (tampilan baru masih dimuat), jadi posisi awal renderer berikutnya. */
export function teleportTo(x: number, z: number) {
  if (active) active.teleport(x, z);
  else selfPos.p = [x, 0, z];
}

/**
 * Ganti mode tampilan. Berdiri dulu di sini (di dalam event klik) — bukan saat renderer lama dilepas — supaya
 * perubahan state tidak terjadi di tengah proses unmount React.
 */
export function switchView(view: View) {
  active?.standUp();
  useGraphics.getState().setView(view);
}
export const toggleSit = () => active?.toggleSit();

/** Pindah ke dekat titik (x, z) — bila di lantai lain, naik lift dulu. */
export function teleportNear(x: number, z: number, floor = useNet.getState().floor) {
  if (floor !== useNet.getState().floor) changeFloor(floor, [x, 0, z]);
  const angle = Math.random() * Math.PI * 2;
  let tx = x + Math.cos(angle) * 1.1;
  let tz = z + Math.sin(angle) * 1.1;
  // Tetap di area yang sama dengan target (supaya langsung bisa ngobrol), kecuali area itu terkunci.
  const target = zoneAt(x, z);
  const landed = zoneAt(tx, tz);
  if (target && landed?.id !== target.id) [tx, tz] = [x + 0.6, z];
  teleportTo(tx, tz);
}
