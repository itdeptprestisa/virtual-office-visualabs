// Denah aktif di sisi client. Data & aturan ada di shared/layout.ts (dipakai juga oleh server);
// modul ini menyimpan turunan denah yang sedang berlaku untuk logika per-frame (Player, media).
import {
  PROXIMITY,
  defaultLayout,
  deriveFloor,
  ejectPoint,
  linkIn,
  zoneIn,
  type Derived,
  type Door,
  type Seat,
  type Zone,
} from "../../shared/layout";

export { PROXIMITY, ejectPoint };
export type { Door, Seat, Zone };

let current: Derived = deriveFloor(defaultLayout().floors[0]);

export const setDerived = (d: Derived) => (current = d);
export const world = () => current;

export const zoneAt = (x: number, z: number): Zone | null => zoneIn(current, x, z);

/** Siapa mendengar siapa (lihat linkIn di shared/layout.ts). */
export const audioLink = (ax: number, az: number, bx: number, bz: number) => linkIn(current, ax, az, bx, bz);

export const DOOR_REACH = 2.5; // jarak maksimal untuk membuka/menutup (m)
export const SEAT_REACH = 1.2;

export function doorNear(x: number, z: number): Door | null {
  return (
    current.doors.find((d) => {
      const [along, across] = d.orient === "x" ? [x, z] : [z, x];
      const a = Math.min(Math.max(along, d.a[0]), d.a[1]);
      return Math.hypot(along - a, across - d.c) <= DOOR_REACH;
    }) ?? null
  );
}

/** Kursi kosong terdekat dalam jangkauan. `taken` = kursi yang sedang diduduki orang lain. */
export function seatNear(x: number, z: number, taken: (s: Seat) => boolean): Seat | null {
  let best: Seat | null = null;
  let bestD = SEAT_REACH;
  for (const s of current.seats) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < bestD && !taken(s)) {
      best = s;
      bestD = d;
    }
  }
  return best;
}
