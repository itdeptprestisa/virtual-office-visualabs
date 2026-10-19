import type { Floor } from "../../shared/layout";

// Kursi di ruang pimpinan (manager & C-level) tampil lebih mewah dari kursi rapat biasa. Ditentukan dari denah,
// bukan jenis furnitur baru, supaya denah tersimpan & mode 2D tidak berubah:
//   - "exec"  = kursi pimpinan: kursi di ruang pimpinan yang berdiri dekat rak buku (di balik meja kerja);
//   - "guest" = kursi lain di ruang yang sama (kursi tamu, meja rapat kecil).
// Kulit hitam untuk ruang C-level, cokelat cognac untuk ruang manager.

export type ChairStyle = { style: "exec" | "guest"; leather: "black" | "cognac" };

const C_LEVEL = new Set(["ceo", "coo"]);
const isManager = (roomId: string) => roomId.startsWith("manager-");
const OWNER_DIST = 1.3; // kursi pimpinan berjarak ±1 m dari rak buku di belakangnya

export function chairStyles(floor: Floor): Map<string, ChairStyle> {
  const out = new Map<string, ChairStyle>();
  const shelves = floor.items.filter((it) => it.type === "bookshelf");
  for (const it of floor.items) {
    if (it.type !== "chair") continue;
    const room = floor.rooms.find((r) => it.x >= r.x[0] && it.x <= r.x[1] && it.z >= r.z[0] && it.z <= r.z[1] && (C_LEVEL.has(r.id) || isManager(r.id)));
    if (!room) continue;
    const owner = shelves.some((s) => Math.hypot(s.x - it.x, s.z - it.z) <= OWNER_DIST);
    out.set(it.id, { style: owner ? "exec" : "guest", leather: C_LEVEL.has(room.id) ? "black" : "cognac" });
  }
  return out;
}
