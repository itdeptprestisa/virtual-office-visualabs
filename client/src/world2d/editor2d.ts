import type { Item } from "../../../shared/layout";
import { FOOTPRINT } from "../../../shared/furniture";

/** Furnitur di titik (x,z): yang radius sorotannya memuat titik, dipilih yang terkecil (paling spesifik). */
export function hitItem(items: Item[], x: number, z: number): Item | null {
  let best: Item | null = null;
  for (const it of items) {
    const r = FOOTPRINT[it.type];
    if (Math.hypot(it.x - x, it.z - z) <= r && (!best || r < FOOTPRINT[best.type])) best = it;
  }
  return best;
}
