// Model denah kantor — dipakai bersama oleh server & client.
// Denah = beberapa lantai; tiap lantai berisi ruangan (dinding kaca + pintu), area terbuka, dan furnitur.
// Area meja, pintu, kursi & dinding diturunkan otomatis dari data ini, sehingga denah bisa diubah lewat editor.

// Batas gedung (m). Tidak simetris: sisi utara (z < -13) adalah perluasan untuk town hall di Lantai 1.
export const WORLD = { minX: -18, maxX: 18, minZ: -23, maxZ: 13, wallH: 3 };

export const PROXIMITY = {
  full: 2, // volume penuh sampai jarak ini (m)
  hear: 4, // terdengar sampai jarak ini (m) — ditandai lingkaran di lantai
  hysteresis: 1, // baru diputus setelah hear + hysteresis, supaya tidak kedip-kedip
};

export const ITEM_TYPES = [
  "desk",
  "chair",
  "sofa",
  "tableLarge",
  "tableSmall",
  "coffeeTable",
  "rug",
  "plant",
  "reception",
  "counter",
  "fridge",
  "bookshelf",
  "screen",
  "whiteboard",
  "podium",
  "elevator",
  "arcade",
  "gameTable",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_LABELS: Record<ItemType, string> = {
  desk: "Meja kerja",
  chair: "Kursi",
  sofa: "Sofa",
  tableLarge: "Meja rapat besar",
  tableSmall: "Meja kecil",
  coffeeTable: "Meja kopi",
  rug: "Karpet",
  plant: "Tanaman",
  reception: "Resepsionis",
  counter: "Konter pantry",
  fridge: "Kulkas",
  bookshelf: "Rak buku",
  screen: "Layar presentasi",
  whiteboard: "Whiteboard",
  podium: "Podium",
  elevator: "Lift",
  arcade: "Mesin arcade",
  gameTable: "Meja Empat Sejajar",
};

export type Quarter = 0 | 1 | 2 | 3; // rotasi kelipatan 90°

export interface Item {
  id: string;
  type: ItemType;
  x: number;
  z: number;
  rot: Quarter;
}

export type Side = "n" | "s" | "e" | "w";

export interface Room {
  id: string;
  name: string;
  x: [number, number];
  z: [number, number];
  door: { side: Side; center: number; width: number };
  color: string;
}

export type Area = { id: string; name: string; color: string; stage?: boolean } & (
  | { shape: "rect"; x: [number, number]; z: [number, number] }
  | { shape: "circle"; cx: number; cz: number; r: number }
);

export interface Floor {
  id: string;
  name: string;
  rooms: Room[];
  areas: Area[];
  items: Item[];
}

export interface Layout {
  version: 2;
  floors: Floor[];
}

export type Zone = {
  id: string;
  name: string;
  color: string;
  kind: "desk" | "room" | "area";
  refId: string;
  stage?: boolean; // panggung: yang berdiri di sini terdengar oleh semua orang di lantai (kecuali di dalam ruangan)
} & ({ shape: "rect"; x: [number, number]; z: [number, number] } | { shape: "circle"; cx: number; cz: number; r: number });

export interface Door {
  id: string; // = id ruangan
  name: string;
  room: string; // id zona ruangan
  orient: "x" | "z"; // dinding sejajar sumbu x (utara/selatan) atau z (timur/barat)
  a: [number, number]; // rentang celah di sepanjang dinding
  c: number; // posisi dinding di sumbu lainnya
}

export interface Seat {
  id: string;
  itemId: string;
  x: number;
  z: number;
  yaw: number; // arah hadap saat duduk (rotation.y)
  stand: [number, number]; // titik berdiri setelah bangun
}

export interface WallSegment {
  orient: "x" | "z";
  a: [number, number];
  c: number;
}

export interface Elevator {
  itemId: string;
  x: number;
  z: number;
  exit: [number, number]; // titik keluar di depan pintu lift
  yaw: number;
}

// ---------- geometri ----------

export const angleOf = (q: Quarter) => (q * Math.PI) / 2;

/** Titik lokal item → dunia (sama dengan rotation.y = angleOf(rot) di three.js). */
export function toWorld(item: Pick<Item, "x" | "z" | "rot">, lx: number, lz: number): [number, number] {
  const t = angleOf(item.rot);
  const c = Math.round(Math.cos(t));
  const s = Math.round(Math.sin(t));
  return [item.x + lx * c + lz * s, item.z - lx * s + lz * c];
}

function rectToWorld(item: Item, x0: number, x1: number, z0: number, z1: number): { x: [number, number]; z: [number, number] } {
  const a = toWorld(item, x0, z0);
  const b = toWorld(item, x1, z1);
  return { x: [Math.min(a[0], b[0]), Math.max(a[0], b[0])], z: [Math.min(a[1], b[1]), Math.max(a[1], b[1])] };
}

// Kursi per jenis furnitur: posisi lokal + arah hadap lokal (0 = menghadap +z lokal)
// + jarak titik berdiri searah hadap (negatif = mundur ke belakang kursi, mis. kursi yang menghadap meja).
const SEATS: Partial<Record<ItemType, { lx: number; lz: number; yaw: number; stand: number }[]>> = {
  desk: [{ lx: 0, lz: 0.75, yaw: Math.PI, stand: -0.75 }],
  chair: [{ lx: 0, lz: 0, yaw: 0, stand: -0.75 }],
  sofa: [-0.7, 0, 0.7].map((lx) => ({ lx, lz: 0.08, yaw: 0, stand: 0.85 })),
};

// ---------- turunan per lantai ----------

export interface Derived {
  floorId: string;
  zones: Zone[];
  doors: Door[];
  seats: Seat[];
  walls: WallSegment[];
  elevators: Elevator[];
}

export function deriveFloor(floor: Floor): Derived {
  const zones: Zone[] = [];
  let deskNo = 0;
  for (const it of floor.items) {
    if (it.type !== "desk") continue;
    deskNo++;
    zones.push({ id: `desk:${it.id}`, name: `Meja ${deskNo}`, color: "#e0a458", kind: "desk", refId: it.id, shape: "rect", ...rectToWorld(it, -0.95, 0.95, -0.6, 1.4) });
  }
  for (const r of floor.rooms) {
    zones.push({ id: `room:${r.id}`, name: r.name, color: r.color, kind: "room", refId: r.id, shape: "rect", x: [r.x[0] + 0.1, r.x[1] - 0.1], z: [r.z[0] + 0.1, r.z[1] - 0.1] });
  }
  for (const a of floor.areas) {
    zones.push({ ...a, id: `area:${a.id}`, kind: "area", refId: a.id } as Zone);
  }

  const doors: Door[] = floor.rooms.map((r) => {
    const { side, center, width } = r.door;
    const orient = side === "n" || side === "s" ? "x" : "z";
    const c = side === "n" ? r.z[0] : side === "s" ? r.z[1] : side === "w" ? r.x[0] : r.x[1];
    return { id: r.id, name: `Pintu ${r.name}`, room: `room:${r.id}`, orient, a: [center - width / 2, center + width / 2], c };
  });

  const seats: Seat[] = [];
  const elevators: Elevator[] = [];
  for (const it of floor.items) {
    (SEATS[it.type] ?? []).forEach((s, i) => {
      const [x, z] = toWorld(it, s.lx, s.lz);
      const yaw = angleOf(it.rot) + s.yaw;
      const stand: [number, number] = [x + Math.sin(yaw) * s.stand, z + Math.cos(yaw) * s.stand];
      seats.push({ id: `${it.id}:${i}`, itemId: it.id, x, z, yaw, stand });
    });
    if (it.type === "elevator") elevators.push({ itemId: it.id, x: it.x, z: it.z, exit: toWorld(it, 0, 1.2), yaw: angleOf(it.rot) });
  }

  // Dinding kaca ruangan: 4 sisi minus celah pintu; sisi yang menempel dinding luar dilewati.
  const walls: WallSegment[] = [];
  const onOuter = (orient: "x" | "z", c: number) =>
    orient === "x"
      ? Math.min(Math.abs(c - WORLD.minZ), Math.abs(c - WORLD.maxZ)) < 0.35
      : Math.min(Math.abs(c - WORLD.minX), Math.abs(c - WORLD.maxX)) < 0.35;
  for (const r of floor.rooms) {
    const sides: [Side, "x" | "z", [number, number], number][] = [
      ["n", "x", r.x, r.z[0]],
      ["s", "x", r.x, r.z[1]],
      ["w", "z", r.z, r.x[0]],
      ["e", "z", r.z, r.x[1]],
    ];
    for (const [side, orient, span, c] of sides) {
      if (onOuter(orient, c)) continue;
      if (r.door.side === side) {
        const d0 = r.door.center - r.door.width / 2;
        const d1 = r.door.center + r.door.width / 2;
        if (d0 - span[0] > 0.05) walls.push({ orient, a: [span[0], d0], c });
        if (span[1] - d1 > 0.05) walls.push({ orient, a: [d1, span[1]], c });
      } else {
        walls.push({ orient, a: [span[0], span[1]], c });
      }
    }
  }
  return { floorId: floor.id, zones, doors, seats, walls, elevators };
}

/** Turunan semua lantai, dikunci id lantai. */
export function derive(layout: Layout): Record<string, Derived> {
  return Object.fromEntries(layout.floors.map((f) => [f.id, deriveFloor(f)]));
}

export function inZone(zn: Zone, x: number, z: number) {
  if (zn.shape === "rect") return x >= zn.x[0] && x <= zn.x[1] && z >= zn.z[0] && z <= zn.z[1];
  return Math.hypot(x - zn.cx, z - zn.cz) <= zn.r;
}

export function zoneIn(d: Derived, x: number, z: number): Zone | null {
  return d.zones.find((zn) => inZone(zn, x, z)) ?? null;
}

/**
 * Aturan siapa mendengar siapa, dari sudut pendengar (a) terhadap pembicara (b) di lantai yang sama.
 * distance = jarak efektif untuk langganan track (0 = tersambung penuh), volume 0..1.
 *   - Pembicara di panggung → terdengar penuh oleh semua orang di lantai, kecuali yang di dalam ruangan.
 *   - Salah satu di area → tersambung penuh hanya bila areanya sama.
 *   - Keduanya di luar area → radius dekat (PROXIMITY).
 */
export function linkIn(d: Derived, ax: number, az: number, bx: number, bz: number): { distance: number; volume: number } {
  const za = zoneIn(d, ax, az);
  const zb = zoneIn(d, bx, bz);
  if (zb?.stage && za?.kind !== "room") return { distance: 0, volume: 1 };
  if (za || zb) return za?.id === zb?.id ? { distance: 0, volume: 1 } : { distance: Infinity, volume: 0 };
  const { full, hear } = PROXIMITY;
  const distance = Math.hypot(bx - ax, bz - az);
  const volume = distance <= full ? 1 : Math.max(0, 1 - (distance - full) / (hear - full));
  return { distance, volume };
}

/** Titik terdekat di luar zona (untuk mendorong keluar orang dari meja yang dikunci / teleport di dekat orang). */
export function ejectPoint(zn: Zone, x: number, z: number, margin = 0.45): [number, number] {
  if (zn.shape === "circle") {
    const dd = Math.hypot(x - zn.cx, z - zn.cz) || 1;
    const k = (zn.r + margin) / dd;
    return [zn.cx + (x - zn.cx) * k, zn.cz + (z - zn.cz) * k];
  }
  const options: [number, number, number][] = [
    [x - zn.x[0], zn.x[0] - margin, z],
    [zn.x[1] - x, zn.x[1] + margin, z],
    [z - zn.z[0], x, zn.z[0] - margin],
    [zn.z[1] - z, x, zn.z[1] + margin],
  ];
  options.sort((p, q) => p[0] - q[0]);
  return [options[0][1], options[0][2]];
}

// ---------- denah bawaan ----------

let seq = 0;
const it = (type: ItemType, x: number, z: number, rot: Quarter = 0): Item => ({ id: `i${++seq}`, type, x, z, rot });

function floor1(): Floor {
  const items: Item[] = [];
  // Area kerja
  for (const row of [-9.5, -5.5, -1.5]) for (const col of [-14.5, -12.5, -8.5, -6.5]) items.push(it("desk", col, row));
  items.push(it("plant", -17, -12), it("plant", -10.5, -11.6), it("plant", -17, 1.8), it("bookshelf", -17.6, -5, 1));
  // Ruang Meeting
  items.push(it("tableLarge", 10.9, -7.5), it("screen", 10.9, -12.75), it("whiteboard", 17.55, -7.5, 3));
  for (const dx of [-2.2, -0.7, 0.8, 2.3]) items.push(it("chair", 10.9 + dx, -9.1, 0), it("chair", 10.9 + dx, -5.9, 2));
  // Ruang Fokus A & B
  for (const [cx, wbx, wbr] of [[-2.5, -4.45, 1], [1.8, 3.45, 3]] as const) {
    items.push(it("tableSmall", cx, -10.4), it("chair", cx, -11.3, 0), it("chair", cx, -9.5, 2), it("whiteboard", wbx, -10.4, wbr));
  }
  // Lounge
  items.push(it("rug", 12, 7.5), it("sofa", 12, 4.5, 0), it("sofa", 15.2, 7.5, 3), it("sofa", 8.8, 7.5, 1), it("coffeeTable", 12, 7.5));
  items.push(it("plant", 16.8, 3));
  // Resepsionis
  items.push(it("reception", 0, 4), it("plant", -2.6, 4), it("plant", 2.6, 4));
  // Pantry
  items.push(it("counter", -13.5, 12.2, 2), it("fridge", -16.9, 12.1, 2), it("tableSmall", -13, 7.6));
  items.push(it("chair", -13, 6.7, 0), it("chair", -13, 8.5, 2), it("plant", -17, 4.2));
  // Lift ke lantai lain (pojok tenggara, menghadap utara)
  items.push(it("elevator", 16.9, 11.9, 2));
  // Town hall (sisi utara gedung): panggung + podium + layar, kursi penonton menghadap panggung (utara)
  items.push(it("podium", 0, -20.6, 0), it("screen", 0, -22.75), it("plant", -5.3, -22.2), it("plant", 5.3, -22.2));
  for (const z of [-17.4, -16.0, -14.6]) for (let x = -9.1; x <= 9.11; x += 1.3) items.push(it("chair", Math.round(x * 100) / 100, z, 2));
  return {
    id: "f1",
    name: "Lantai 1",
    rooms: [
      { id: "meeting", name: "Ruang Meeting", x: [4, 17.85], z: [-12.85, -2], door: { side: "s", center: 9.875, width: 2.75 }, color: "#5b8def" },
      { id: "fokus-a", name: "Ruang Fokus A", x: [-4.6, -0.4], z: [-12.85, -8], door: { side: "s", center: -2.5, width: 1.6 }, color: "#8b7cf6" },
      { id: "fokus-b", name: "Ruang Fokus B", x: [0, 3.6], z: [-12.85, -8], door: { side: "s", center: 1.8, width: 1.6 }, color: "#8b7cf6" },
    ],
    areas: [
      { id: "lounge", name: "Lounge", color: "#e8707f", shape: "circle", cx: 12, cz: 7.5, r: 4.3 },
      { id: "pantry", name: "Pantry", color: "#4fae7d", shape: "rect", x: [-17.6, -9.5], z: [3.4, 12.7] },
      { id: "townhall", name: "Town Hall", color: "#f2994a", shape: "rect", x: [-4.5, 4.5], z: [-22.85, -19.3], stage: true },
    ],
    items,
  };
}

function floor2(): Floor {
  const items: Item[] = [];
  // Arcade: mesin arcade di dinding utara, meja Empat Sejajar (2 pemain) dengan kursi berhadapan
  for (const x of [-4.5, -1.5, 1.5, 4.5]) items.push(it("arcade", x, -22.3, 0));
  for (const [x, z] of [[-8, -12], [8, -12], [-8, -2], [8, -2]]) items.push(it("gameTable", x, z), it("chair", x, z - 1.1, 0), it("chair", x, z + 1.1, 2));
  items.push(it("elevator", 16.9, 11.9, 2));
  return { id: "f2", name: "Lantai 2", rooms: [], areas: [], items };
}

export function defaultLayout(): Layout {
  seq = 0;
  return { version: 2, floors: [floor1(), floor2()] };
}

// ---------- validasi (server memakai ini untuk denah kiriman editor) ----------

const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[a-z0-9_-]{1,40}$/i;

function span(v: unknown, lo: number, hi: number): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const a = num(v[0], lo, hi);
  const b = num(v[1], lo, hi);
  if (a === null || b === null || b - a < 1) return null;
  return [a, b];
}

function sanitizeFloor(src: Record<string, unknown>, uniq: (id: unknown) => string | null): Floor | null {
  if (!Array.isArray(src.rooms) || !Array.isArray(src.areas) || !Array.isArray(src.items)) return null;
  if (src.rooms.length > 20 || src.areas.length > 20 || src.items.length > 600) return null;
  const id = uniq(src.id);
  const name = str(src.name, 40);
  if (!id || !name) return null;

  const rooms: Room[] = [];
  for (const r of src.rooms as Record<string, any>[]) {
    const rid = uniq(r?.id);
    const rname = str(r?.name, 40);
    const x = span(r?.x, WORLD.minX, WORLD.maxX);
    const z = span(r?.z, WORLD.minZ, WORLD.maxZ);
    const side = ["n", "s", "e", "w"].includes(r?.door?.side) ? (r.door.side as Side) : null;
    const center = num(r?.door?.center, Math.min(WORLD.minX, WORLD.minZ), Math.max(WORLD.maxX, WORLD.maxZ));
    const width = num(r?.door?.width, 0.9, 4);
    if (!rid || !rname || !x || !z || !side || center === null || width === null) return null;
    rooms.push({ id: rid, name: rname, x, z, door: { side, center, width }, color: HEX.test(r?.color) ? r.color : "#5b8def" });
  }
  const areas: Area[] = [];
  for (const a of src.areas as Record<string, any>[]) {
    const aid = uniq(a?.id);
    const aname = str(a?.name, 40);
    const color = HEX.test(a?.color) ? a.color : "#4fae7d";
    const stage = a?.stage === true ? { stage: true } : {};
    if (!aid || !aname) return null;
    if (a.shape === "circle") {
      const cx = num(a.cx, WORLD.minX, WORLD.maxX);
      const cz = num(a.cz, WORLD.minZ, WORLD.maxZ);
      const r = num(a.r, 0.5, 15);
      if (cx === null || cz === null || r === null) return null;
      areas.push({ id: aid, name: aname, color, ...stage, shape: "circle", cx, cz, r });
    } else {
      const x = span(a.x, WORLD.minX, WORLD.maxX);
      const z = span(a.z, WORLD.minZ, WORLD.maxZ);
      if (!x || !z) return null;
      areas.push({ id: aid, name: aname, color, ...stage, shape: "rect", x, z });
    }
  }
  const items: Item[] = [];
  for (const i of src.items as Record<string, any>[]) {
    const iid = uniq(i?.id);
    const type = (ITEM_TYPES as readonly string[]).includes(i?.type) ? (i.type as ItemType) : null;
    const x = num(i?.x, WORLD.minX, WORLD.maxX);
    const z = num(i?.z, WORLD.minZ, WORLD.maxZ);
    const rot = [0, 1, 2, 3].includes(i?.rot) ? (i.rot as Quarter) : null;
    if (!iid || !type || x === null || z === null || rot === null) return null;
    items.push({ id: iid, type, x, z, rot });
  }
  return { id, name, rooms, areas, items };
}

/** Validasi denah (v2), sekaligus menerima denah lama v1 (satu lantai) dan mengubahnya ke v2. */
export function sanitizeLayout(raw: unknown): Layout | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const ids = new Set<string>();
  const uniq = (id: unknown) => (typeof id === "string" && ID.test(id) && !ids.has(id) ? (ids.add(id), id) : null);
  const floorsRaw = Array.isArray(src.floors) ? src.floors : Array.isArray(src.items) ? [{ id: "f1", name: "Lantai 1", ...src }] : null;
  if (!floorsRaw || floorsRaw.length < 1 || floorsRaw.length > 10) return null;
  const floors: Floor[] = [];
  for (const f of floorsRaw) {
    const fl = f && typeof f === "object" ? sanitizeFloor(f as Record<string, unknown>, uniq) : null;
    if (!fl) return null;
    floors.push(fl);
  }
  return { version: 2, floors };
}
