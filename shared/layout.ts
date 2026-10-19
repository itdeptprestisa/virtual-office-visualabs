// Model denah kantor — dipakai bersama oleh server & client.
// Denah = beberapa lantai; tiap lantai berisi ruangan (dinding kaca + pintu), area terbuka, dan furnitur.
// Area meja, pintu, kursi & dinding diturunkan otomatis dari data ini, sehingga denah bisa diubah lewat editor.

// Batas gedung (m). Lantai 1 dari utara ke selatan: town hall, 2 baris × 3 divisi, lalu fasilitas umum.
export const WORLD = { minX: -33, maxX: 33, minZ: -44, maxZ: 26.5, wallH: 3 };

/** Titik muncul acak (di depan resepsionis Lantai 1, di luar zona mana pun). */
export const SPAWN = { x: [-4, 4] as [number, number], z: [14, 19] as [number, number] };

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
  "toilet",
  "sink",
  "prayerMat",
  "clock",
  "dispenser",
  "frame",
  "floorLamp",
  "printer",
  "bin",
  "magazineRack",
  "window",
  "treePlant",
  "rugRect",
  "noticeBoard",
  "beanBag",
  "coffeeMachine",
  "vending",
  "snackShelf",
  "barStool",
  "hangingPlant",
  "poster",
  "wallShelf",
  "tv",
  "logoBoard",
  "pingPong",
  "foosball",
  "billiard",
  "prizeShelf",
  "playRug",
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
  toilet: "Bilik toilet",
  sink: "Wastafel",
  prayerMat: "Sajadah",
  clock: "Jam dinding",
  dispenser: "Dispenser air",
  frame: "Bingkai foto",
  floorLamp: "Lampu lantai",
  printer: "Printer",
  bin: "Tempat sampah",
  magazineRack: "Rak majalah",
  window: "Jendela",
  treePlant: "Tanaman besar",
  rugRect: "Karpet persegi",
  noticeBoard: "Papan pengumuman",
  beanBag: "Bean bag",
  coffeeMachine: "Mesin kopi",
  vending: "Vending machine",
  snackShelf: "Rak snack",
  barStool: "Kursi bar",
  hangingPlant: "Tanaman gantung",
  poster: "Poster",
  wallShelf: "Rak dinding",
  tv: "TV",
  logoBoard: "Papan logo",
  pingPong: "Meja ping-pong",
  foosball: "Meja foosball",
  billiard: "Meja biliar",
  prizeShelf: "Rak hadiah",
  playRug: "Karpet main",
};

/**
 * Aturan suara di dalam ruangan/area:
 *   full = semua yang di dalam saling dengar penuh (ruang rapat, ruang manager);
 *   near = di dalam hanya terdengar jarak dekat, dari luar tidak terdengar (divisi, aula, pantry);
 *   mute = senyap, tidak terdengar & tidak mendengar siapa pun (toilet, mushola).
 */
export const AUDIO_MODES = ["full", "near", "mute"] as const;
export type Audio = (typeof AUDIO_MODES)[number];

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
  audio?: Audio; // bawaan "full"
}

export type Area = { id: string; name: string; color: string; stage?: boolean; audio?: Audio } & (
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
  audio: Audio;
  parent?: string; // id zona terkecil yang melingkupinya (mis. ruang manager → divisi, panggung → aula)
  stage?: boolean; // panggung: terdengar oleh semua orang di ruangan tempat panggung berada (atau seluruh lantai bila di luar ruangan)
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
  beanBag: [{ lx: 0, lz: 0, yaw: 0, stand: -0.8 }],
  barStool: [{ lx: 0, lz: 0, yaw: 0, stand: -0.7 }],
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
    zones.push({ id: `desk:${it.id}`, name: `Meja ${deskNo}`, color: "#e0a458", kind: "desk", refId: it.id, audio: "full", shape: "rect", ...rectToWorld(it, -0.95, 0.95, -0.6, 1.4) });
  }
  for (const r of floor.rooms) {
    zones.push({ id: `room:${r.id}`, name: r.name, color: r.color, kind: "room", refId: r.id, audio: r.audio ?? "full", shape: "rect", x: [r.x[0] + 0.1, r.x[1] - 0.1], z: [r.z[0] + 0.1, r.z[1] - 0.1] });
  }
  for (const a of floor.areas) {
    zones.push({ ...a, id: `area:${a.id}`, kind: "area", refId: a.id, audio: a.audio ?? "full" } as Zone);
  }
  // Zona bisa bertumpuk (ruang manager di dalam divisi, panggung di dalam aula): catat induk terkecilnya.
  for (const zn of zones) {
    const b = bounds(zn);
    let best: Zone | null = null;
    for (const o of zones) {
      if (o === zn || o.kind === "desk" || sizeOf(o) <= sizeOf(zn)) continue;
      const ob = bounds(o);
      const inside = zn.kind === "desk" ? inZone(o, (b.x[0] + b.x[1]) / 2, (b.z[0] + b.z[1]) / 2) : b.x[0] >= ob.x[0] && b.x[1] <= ob.x[1] && b.z[0] >= ob.z[0] && b.z[1] <= ob.z[1];
      if (inside && (!best || sizeOf(o) < sizeOf(best))) best = o;
    }
    if (best) zn.parent = best.id;
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

function bounds(zn: Zone): { x: [number, number]; z: [number, number] } {
  return zn.shape === "rect" ? { x: zn.x, z: zn.z } : { x: [zn.cx - zn.r, zn.cx + zn.r], z: [zn.cz - zn.r, zn.cz + zn.r] };
}

const sizeOf = (zn: Zone) => (zn.shape === "rect" ? (zn.x[1] - zn.x[0]) * (zn.z[1] - zn.z[0]) : Math.PI * zn.r * zn.r);

/** Zona terdalam (terkecil) di titik itu — meja di dalam divisi menang atas divisinya. `skipDesks` mengabaikan zona meja. */
export function zoneIn(d: Derived, x: number, z: number, skipDesks = false): Zone | null {
  let best: Zone | null = null;
  for (const zn of d.zones) {
    if (skipDesks && zn.kind === "desk") continue;
    if (inZone(zn, x, z) && (!best || sizeOf(zn) < sizeOf(best))) best = zn;
  }
  return best;
}

/** Kedalaman sarang zona: 0 = tidak di dalam zona lain, 1 = di dalam satu zona (mis. ruang manager di divisi), dst. */
export function zoneDepth(zones: Zone[], zn: Zone): number {
  let depth = 0;
  for (let z = zn; z.parent && depth < 8; depth++) {
    const p = zones.find((o) => o.id === z.parent);
    if (!p) break;
    z = p;
  }
  return depth;
}

/** Ruangan yang melingkupi zona ini (zona itu sendiri bila ruangan), atau null bila di ruang terbuka lantai. */
export function roomOf(d: Derived, zn: Zone | null): Zone | null {
  for (let z = zn; z; z = z.parent ? d.zones.find((o) => o.id === z!.parent) ?? null : null) if (z.kind === "room") return z;
  return null;
}

const near = (ax: number, az: number, bx: number, bz: number) => {
  const { full, hear } = PROXIMITY;
  const distance = Math.hypot(bx - ax, bz - az);
  const volume = distance <= full ? 1 : Math.max(0, 1 - (distance - full) / (hear - full));
  return { distance, volume };
};

/**
 * Aturan siapa mendengar siapa, dari sudut pendengar (a) terhadap pembicara (b) di lantai yang sama.
 * distance = jarak efektif untuk langganan track (0 = tersambung penuh), volume 0..1.
 *   - Pembicara di panggung → terdengar penuh oleh semua orang di ruangan yang sama dengan panggung
 *     (panggung di ruang terbuka → semua orang di lantai yang tidak sedang di dalam ruangan).
 *   - Salah satu di zona → hanya tersambung bila zonanya sama (zona terdalam), lalu menurut aturan suara zona itu:
 *     full = penuh, near = radius dekat, mute = tidak sama sekali.
 *   - Keduanya di luar zona → radius dekat (PROXIMITY).
 */
export function linkIn(d: Derived, ax: number, az: number, bx: number, bz: number): { distance: number; volume: number } {
  const za = zoneIn(d, ax, az);
  const zb = zoneIn(d, bx, bz);
  if (zb?.stage && roomOf(d, za)?.id === roomOf(d, zb)?.id) return { distance: 0, volume: 1 };
  if (za || zb) {
    if (za?.id !== zb?.id || za!.audio === "mute") return { distance: Infinity, volume: 0 };
    return za!.audio === "near" ? near(ax, az, bx, bz) : { distance: 0, volume: 1 };
  }
  return near(ax, az, bx, bz);
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
// Dekorasi punya penomoran sendiri supaya id item lama (dirujuk kepemilikan meja & URL layar) tidak bergeser.
let decoSeq = 0;
const deco = (type: ItemType, x: number, z: number, rot: Quarter = 0): Item => ({ id: `d${++decoSeq}`, type, x, z, rot });
// Dekorasi gelombang kedua — penomoran sendiri lagi, supaya id gelombang pertama tetap.
let decoSeq2 = 0;
const deco2 = (type: ItemType, x: number, z: number, rot: Quarter = 0): Item => ({ id: `e${++decoSeq2}`, type, x, z, rot });

const DIV_DEPTH = 16;
const DIV_COLORS = ["#5b8def", "#4fae7d", "#e0a458", "#8b7cf6", "#e8707f", "#3fb6c6"];
const NORTH = -28; // dinding selatan deretan town hall + ruang CEO/COO
const SOUTH = 12.5; // dinding utara deretan fasilitas umum

/** Meja + kursi di keempat sisi. `long` = kursi per sisi panjang; meja memanjang searah sumbu x (rot 0) atau z (rot 1). */
function tableSet(items: Item[], type: "tableLarge" | "tableSmall", x: number, z: number, along: "x" | "z", long: number[], side: number, end: number) {
  items.push(it(type, x, z, along === "x" ? 0 : 1));
  for (const d of long) {
    if (along === "x") items.push(it("chair", x + d, z - side, 0), it("chair", x + d, z + side, 2));
    else items.push(it("chair", x - side, z + d, 1), it("chair", x + side, z + d, 3));
  }
  if (along === "x") items.push(it("chair", x - end, z, 1), it("chair", x + end, z, 3));
  else items.push(it("chair", x, z - end, 0), it("chair", x, z + end, 2));
}

/**
 * Satu divisi (ruangan berdinding kaca, suara jarak dekat): ruang manager & ruang rapat menempel dinding belakang,
 * 10 meja pekerja (2 baris × 5) menghadap dinding belakang, pintu di dinding depan (sisi lorong).
 * `back` = posisi z dinding belakang, `dir` = arah masuk dari dinding belakang ke pintu (+1 ke selatan, -1 ke utara).
 */
function division(n: number, x: [number, number], back: number, dir: 1 | -1, rooms: Room[], items: Item[]) {
  const Z = (u: number) => back + dir * u; // u = jarak dari dinding belakang
  const R = (q: Quarter): Quarter => (dir === 1 ? q : (((q + 2) % 4) as Quarter)); // q=0 menghadap ke arah pintu
  const zs = (u0: number, u1: number): [number, number] => [Math.min(Z(u0), Z(u1)), Math.max(Z(u0), Z(u1))];
  const front: Side = dir === 1 ? "s" : "n";
  const [x0, x1] = x;
  const cx = (x0 + x1) / 2;
  const color = DIV_COLORS[(n - 1) % DIV_COLORS.length];
  rooms.push({ id: `divisi-${n}`, name: `Divisi ${n}`, x, z: zs(0, DIV_DEPTH), door: { side: front, center: cx, width: 2.4 }, color, audio: "near" });

  // Ruang manager: meja + kursi manager membelakangi dinding, 2 kursi tamu, rak buku.
  const mx = x0 + 3.3;
  rooms.push({ id: `manager-${n}`, name: `Manager Divisi ${n}`, x: [x0 + 0.3, x0 + 6.3], z: zs(0.3, 6), door: { side: front, center: mx, width: 1.6 }, color, audio: "full" });
  items.push(it("bookshelf", mx, Z(0.6), R(0)), it("chair", mx, Z(1.7), R(0)), it("tableSmall", mx, Z(2.6)));
  items.push(it("chair", mx - 0.6, Z(3.6), R(2)), it("chair", mx + 0.6, Z(3.6), R(2)), it("plant", x0 + 5.6, Z(5.3)));

  // Ruang rapat: meja besar dengan 12 kursi (5 di tiap sisi panjang + 1 di tiap ujung), layar di dinding belakang.
  const rx = x1 - 5.8;
  rooms.push({ id: `rapat-${n}`, name: `Rapat Divisi ${n}`, x: [x1 - 11.3, x1 - 0.3], z: zs(0.3, 7.5), door: { side: front, center: rx, width: 2 }, color, audio: "full" });
  items.push(it("screen", rx, Z(0.55), R(0)));
  tableSet(items, "tableLarge", rx, Z(3.9), "x", [-2.4, -1.2, 0, 1.2, 2.4], 1.75, 3.6);

  // 10 meja pekerja.
  for (const u of [9.6, 13]) for (const dx of [-7.2, -3.6, 0, 3.6, 7.2]) items.push(it("desk", cx + dx, Z(u), R(0)));
  items.push(it("plant", x0 + 0.7, Z(15.3)), it("plant", x1 - 0.7, Z(15.3)));

  // Dekorasi: bingkai & jam di dinding belakang (celah antara ruang manager & ruang rapat), dispenser, tempat sampah.
  items.push(deco("frame", x0 + 7, Z(0.12), R(0)), deco("clock", x0 + 8.2, Z(0.12), R(0)));
  items.push(deco("dispenser", x0 + 0.5, Z(7.2)), deco("bin", x1 - 0.5, Z(8.2)), deco("bin", x0 + 0.5, Z(11.5)));
}

/** Ruang eksekutif (sisi utara, pintu ke lorong selatan): meja kerja + rak, set sofa tamu, meja rapat kecil 4 kursi. */
function executive(id: string, name: string, x: [number, number], rooms: Room[], items: Item[]) {
  const cx = (x[0] + x[1]) / 2;
  const top = WORLD.minZ;
  const outer = Math.abs(x[0] - WORLD.minX) < 0.01 ? -1 : 1; // sisi yang menempel dinding luar gedung
  rooms.push({ id, name, x, z: [top, NORTH], door: { side: "s", center: cx, width: 1.8 }, color: "#3d4b6b", audio: "full" });
  items.push(it("bookshelf", cx, top + 0.45), it("chair", cx, top + 1.5), it("tableSmall", cx, top + 2.4));
  const sx = cx + outer * 3.8; // set sofa di sisi dinding luar
  items.push(it("sofa", sx, top + 5.7, 0), it("coffeeTable", sx, top + 7.5), it("sofa", sx, top + 9.3, 2));
  tableSet(items, "tableSmall", cx - outer * 3.6, top + 7.5, "z", [0], 1, 1.3); // meja rapat kecil di sisi town hall
  items.push(it("plant", cx + outer * 6.5, top + 0.7), it("plant", cx - outer * 6.5, top + 0.7));
}

function floor1(): Floor {
  const rooms: Room[] = [];
  const items: Item[] = [];
  const top = WORLD.minZ;

  // Ruang CEO (pojok barat laut) & COO (pojok timur laut), mengapit town hall.
  executive("ceo", "Ruang CEO", [WORLD.minX, -17.2], rooms, items);
  executive("coo", "Ruang COO", [17.2, WORLD.maxX], rooms, items);

  // Town hall (sisi utara, ruangan tertutup di tengah): panggung + podium + layar, 60 kursi menghadap panggung.
  rooms.push({ id: "townhall", name: "Town Hall", x: [-17, 17], z: [top, NORTH], door: { side: "s", center: 0, width: 3.2 }, color: "#f2994a", audio: "near" });
  items.push(it("podium", 0, top + 3, 0), it("screen", 0, top + 0.25), it("plant", -6, top + 0.8), it("plant", 6, top + 0.8));
  for (const z of [-37.5, -35.6, -33.7, -31.8]) for (let x = -12.6; x <= 12.61; x += 1.8) items.push(it("chair", Math.round(x * 100) / 100, z, 2));

  // 6 divisi: baris utara (pintu ke selatan) & baris selatan (pintu ke utara), lorong di tengahnya.
  const cols: [number, number][] = [[-33, -13], [-10, 10], [13, 33]];
  cols.forEach((x, i) => division(i + 1, x, -24.5, 1, rooms, items));
  cols.forEach((x, i) => division(i + 4, x, SOUTH, -1, rooms, items));

  // Pantry: dapur + 3 meja makan × 4 kursi (satu di tiap sisi).
  items.push(it("counter", -25, 25.7, 2), it("counter", -21.6, 25.7, 2), it("fridge", -31.8, 25.6, 2));
  for (const x of [-29, -24.5, -20]) tableSet(items, "tableSmall", x, 19.5, "x", [0], 0.9, 1.25);
  items.push(it("plant", -32.2, 15.2), it("plant", -16.6, 15.2));

  // Toilet: 5 bilik di dinding selatan + 3 di dinding barat, 4 wastafel di dinding timur.
  rooms.push({ id: "toilet", name: "Toilet", x: [-15.5, -4.5], z: [15.5, WORLD.maxZ], door: { side: "n", center: -10, width: 2 }, color: "#6fa8dc", audio: "mute" });
  for (const x of [-14.3, -12.4, -10.5, -8.6, -6.7]) items.push(it("toilet", x, 25.3, 2));
  for (const z of [18, 19.9, 21.8]) items.push(it("toilet", -14.4, z, 1));
  for (const z of [18, 19.5, 21, 22.5]) items.push(it("sink", -4.85, z, 3));

  // Resepsionis (menghadap titik muncul di utaranya).
  items.push(it("reception", 0, 23.5, 2), it("plant", -3, 23.5), it("plant", 3, 23.5));

  // Mushola: 15 sajadah (3 shaf × 5) menghadap kiblat (barat), rak di dinding timur.
  rooms.push({ id: "mushola", name: "Mushola", x: [4.5, 15.5], z: [15.5, WORLD.maxZ], door: { side: "n", center: 10, width: 2 }, color: "#2e9e8f", audio: "mute" });
  for (const x of [6.2, 8.2, 10.2]) for (const z of [17.6, 19.2, 20.8, 22.4, 24]) items.push(it("prayerMat", x, z, 3));
  items.push(it("bookshelf", 15.25, 21, 3), it("plant", 14.9, 25.9), it("plant", 14.9, 16.1));

  // Lounge
  items.push(it("rug", 24, 20), it("sofa", 24, 16.5, 0), it("sofa", 27.5, 20, 3), it("sofa", 20.5, 20, 1), it("coffeeTable", 24, 20), it("plant", 31.8, 14.5));

  // Lift ke lantai lain (pojok tenggara, pintu menghadap utara)
  items.push(it("elevator", LIFT[0], LIFT[1], 2));

  // Dekorasi: printer di lorong tengah (menempel dinding), jendela di dinding luar barat/timur (sedikit masuk supaya tidak tertanam
  // di dinding 3D), lampu lantai di ruang CEO/COO & lounge, rak majalah di lounge & resepsionis.
  items.push(deco("printer", -16, -7.9), deco("printer", 16, -7.9)); // menempel dinding divisi, bukan di persimpangan
  for (const z of [-20, -14, 0, 6, 18]) items.push(deco("window", WORLD.minX + 0.17, z, 1), deco("window", WORLD.maxX - 0.17, z, 3));
  items.push(deco("floorLamp", -31.8, -42.6), deco("floorLamp", 31.8, -42.6), deco("floorLamp", 28.2, 16.6));
  items.push(deco("magazineRack", 20.6, 23.5), deco("magazineRack", -2.2, 25.8, 2));

  // Dekorasi gelombang kedua.
  // Lorong & area kerja: tanaman besar di ujung lorong & pojok pantry/lounge, papan pengumuman di dinding town hall, sudut bean bag.
  // (urutan tetap supaya id tidak bergeser; posisi di luar persimpangan — lihat DECORATION_MOVES)
  for (const [x, z] of [[-32.2, -6], [32.2, -6], [-32.2, -26.25], [32.2, -26.25], [-16.8, 25.6], [19.2, 25.6]]) items.push(deco2("treePlant", x, z));
  items.push(deco2("noticeBoard", -6, -27.92), deco2("noticeBoard", 6, -27.92));
  for (const x of [-31.2, -29.8, 29.8, 31.2]) items.push(deco2("beanBag", x, -4.3, 2));
  // Pantry & lounge: mesin kopi, vending, rak snack, kursi bar di depan konter, tanaman gantung di lounge.
  items.push(deco2("coffeeMachine", -18.4, 25.9, 2), deco2("vending", -32.35, 21.8, 1), deco2("snackShelf", -32.55, 23.7, 1));
  for (const x of [-26, -25, -24, -22.6, -21.6, -20.6]) items.push(deco2("barStool", x, 24.55));
  items.push(deco2("hangingPlant", 22, 24.2), deco2("hangingPlant", 26.5, 24.2));
  // Dinding & resepsionis: poster di dinding luar divisi, karpet & rak dinding & papan logo di resepsionis, TV di lounge.
  for (const z of [-10.5, -2.5]) items.push(deco2("poster", WORLD.minX + 0.12, z, 1), deco2("poster", WORLD.maxX - 0.12, z, 3));
  items.push(deco2("rugRect", 0, 20.5), deco2("logoBoard", 0, 26.38, 2), deco2("wallShelf", -3.8, 26.38, 2), deco2("wallShelf", 3.8, 26.38, 2));
  items.push(deco2("tv", WORLD.maxX - 0.12, 21.6, 3));

  return {
    id: "f1",
    name: "Lantai 1",
    rooms,
    areas: [
      { id: "stage", name: "Panggung Town Hall", color: "#f2994a", shape: "rect", x: [-5, 5], z: [top + 0.2, top + 4.5], stage: true },
      { id: "pantry", name: "Pantry", color: "#4fae7d", shape: "rect", x: [WORLD.minX + 0.2, -16], z: [14.5, WORLD.maxZ - 0.2], audio: "near" },
      { id: "lounge", name: "Lounge", color: "#e8707f", shape: "circle", cx: 24, cz: 20, r: 5 },
    ],
    items,
  };
}

/** Posisi bagian depan (pintu) lift — sama di semua lantai; ruang lift memanjang ke dinding selatan. */
const LIFT: [number, number] = [31.3, 23.9];

function floor2(): Floor {
  const items: Item[] = [];
  // Arcade: mesin arcade di dinding utara, meja Empat Sejajar (2 pemain) dengan kursi berhadapan
  for (const x of [-4.5, -1.5, 1.5, 4.5]) items.push(it("arcade", x, WORLD.minZ + 0.7, 0));
  for (const [x, z] of [[-8, -12], [8, -12], [-8, -2], [8, -2]]) items.push(it("gameTable", x, z), it("chair", x, z - 1.1, 0), it("chair", x, z + 1.1, 2));
  items.push(it("elevator", LIFT[0], LIFT[1], 2));

  // Dekorasi gelombang kedua — arcade & mainan: karpet main di depan mesin arcade, rak hadiah, ping-pong, foosball,
  // biliar, sudut gaming (sofa, bean bag, TV), snack, tanaman & poster.
  items.push(deco2("playRug", 0, -37.5), deco2("prizeShelf", -9, -43.05), deco2("prizeShelf", 9, -43.05));
  for (const x of [-20, 20]) items.push(deco2("pingPong", x, -30), deco2("foosball", x, -18), deco2("billiard", x, -6));
  items.push(deco2("playRug", 0, 22.6), deco2("tv", 0, 26.38, 2), deco2("sofa", 0, 21));
  for (const [x, z] of [[-3.2, 22.5], [3.2, 22.5], [-1.6, 23.6], [1.6, 23.6]]) items.push(deco2("beanBag", x, z));
  items.push(deco2("vending", -32.35, 10, 1), deco2("snackShelf", -32.55, 12.5, 1));
  for (const [x, z] of [[-32.2, -43.2], [32.2, -43.2], [-32.2, 25.7]]) items.push(deco2("treePlant", x, z));
  for (const z of [-20, 0]) items.push(deco2("poster", WORLD.minX + 0.12, z, 1), deco2("poster", WORLD.maxX - 0.12, z, 3));
  return { id: "f2", name: "Lantai 2", rooms: [], areas: [], items };
}

/** Jenis dekorasi (ditambahkan Okt 2026) — dipakai untuk melengkapi denah tersimpan yang dibuat sebelum ada dekorasi. */
export const DECORATION_TYPES = ["clock", "dispenser", "frame", "floorLamp", "printer", "bin", "magazineRack", "window"] as const satisfies readonly ItemType[];
/** Dekorasi gelombang pertama: dikenali dari jenisnya. */
export const isDecoration1 = (i: Item) => (DECORATION_TYPES as readonly ItemType[]).includes(i.type);
/** Dekorasi gelombang kedua: dikenali dari id-nya (termasuk sofa sudut gaming Lantai 2 yang jenisnya sudah ada). */
export const isDecoration2 = (i: Item) => i.id.startsWith("e");
/** Gelombang kedua (Okt 2026): lorong, pantry & lounge, dinding & resepsionis, Lantai 2 (arcade & mainan). */
export const DECORATION_TYPES_2 = ["treePlant", "rugRect", "noticeBoard", "beanBag", "coffeeMachine", "vending", "snackShelf", "barStool", "hangingPlant", "poster", "wallShelf", "tv", "logoBoard", "pingPong", "foosball", "billiard", "prizeShelf", "playRug"] as const satisfies readonly ItemType[];

/**
 * Tambahkan dekorasi denah bawaan ke denah tersimpan: hanya ke lantai yang id-nya sama dan belum punya dekorasi sama
 * sekali (lantai yang dihapus admin tidak dihidupkan lagi; id yang bentrok dilewati).
 */
export function addDecorations(saved: Layout, defaults: Layout, pick: (i: Item) => boolean = isDecoration1): Layout {
  return {
    ...saved,
    floors: saved.floors.map((f) => {
      const src = defaults.floors.find((d) => d.id === f.id);
      if (!src || f.items.some(pick)) return f;
      const ids = new Set(f.items.map((i) => i.id));
      const add = src.items.filter((i) => pick(i) && !ids.has(i.id));
      return add.length ? { ...f, items: [...f.items, ...add] } : f;
    }),
  };
}

/** Dekorasi yang dipindah dari persimpangan lorong (Okt 2026): jenis, posisi lama → posisi baru (Lantai 1). */
export const DECORATION_MOVES: { type: ItemType; from: [number, number]; to: [number, number] }[] = [
  { type: "printer", from: [-11.5, -6], to: [-16, -7.9] },
  { type: "printer", from: [11.5, -6], to: [16, -7.9] },
  { type: "treePlant", from: [-11.5, -26.25], to: [-32.2, -26.25] },
  { type: "treePlant", from: [11.5, -26.25], to: [32.2, -26.25] },
  { type: "treePlant", from: [-12, 13.9], to: [-16.8, 25.6] },
  { type: "treePlant", from: [12, 13.9], to: [19.2, 25.6] },
];

/** Pindahkan dekorasi yang masih di posisi lamanya (yang sudah dipindah admin dibiarkan). */
export function moveDecorations(saved: Layout, moves: typeof DECORATION_MOVES): Layout {
  return {
    ...saved,
    floors: saved.floors.map((f) => ({
      ...f,
      items: f.items.map((i) => {
        const m = moves.find((mv) => mv.type === i.type && Math.abs(mv.from[0] - i.x) < 0.01 && Math.abs(mv.from[1] - i.z) < 0.01);
        return m ? { ...i, x: m.to[0], z: m.to[1] } : i;
      }),
    })),
  };
}

export function defaultLayout(): Layout {
  seq = 0;
  decoSeq = 0;
  decoSeq2 = 0;
  return { version: 2, floors: [floor1(), floor2()] };
}

// ---------- validasi (server memakai ini untuk denah kiriman editor) ----------

const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[a-z0-9_-]{1,40}$/i;

const audioOf = (v: Record<string, any> | undefined): { audio?: Audio } =>
  (AUDIO_MODES as readonly string[]).includes(v?.audio) ? { audio: v!.audio as Audio } : {};

function span(v: unknown, lo: number, hi: number): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const a = num(v[0], lo, hi);
  const b = num(v[1], lo, hi);
  if (a === null || b === null || b - a < 1) return null;
  return [a, b];
}

function sanitizeFloor(src: Record<string, unknown>, uniq: (id: unknown) => string | null): Floor | null {
  if (!Array.isArray(src.rooms) || !Array.isArray(src.areas) || !Array.isArray(src.items)) return null;
  if (src.rooms.length > 40 || src.areas.length > 20 || src.items.length > 600) return null;
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
    rooms.push({ id: rid, name: rname, x, z, door: { side, center, width }, color: HEX.test(r?.color) ? r.color : "#5b8def", ...audioOf(r) });
  }
  const areas: Area[] = [];
  for (const a of src.areas as Record<string, any>[]) {
    const aid = uniq(a?.id);
    const aname = str(a?.name, 40);
    const color = HEX.test(a?.color) ? a.color : "#4fae7d";
    const stage = { ...(a?.stage === true ? { stage: true } : {}), ...audioOf(a) };
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
