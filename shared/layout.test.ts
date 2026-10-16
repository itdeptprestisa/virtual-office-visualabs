import { test } from "node:test";
import assert from "node:assert/strict";
import { PROXIMITY, WORLD, defaultLayout, derive, linkIn, sanitizeLayout, toWorld, zoneIn } from "./layout";

const d = derive(defaultLayout()).f1;
const d2 = derive(defaultLayout()).f2;
const zoneAt = (x: number, z: number) => zoneIn(d, x, z);
const connected = (ax: number, az: number, bx: number, bz: number) => linkIn(d, ax, az, bx, bz).distance < PROXIMITY.hear;

test("di luar area: tersambung hanya bila dekat (≤ 4 m)", () => {
  assert.equal(zoneAt(0, 9), null);
  assert.equal(connected(0, 9, 3, 9), true);
  assert.equal(connected(0, 9, 5.5, 9), false);
  assert.equal(linkIn(d, 0, 9, 1.5, 9).volume, 1);
  assert.ok(linkIn(d, 0, 9, 3, 9).volume < 1);
});

test("orang di area tidak terdengar oleh orang di luar, walau dekat", () => {
  assert.equal(zoneAt(8.2, 7.5)?.name, "Lounge");
  assert.equal(connected(4.5, 7.5, 8.2, 7.5), false);
  assert.equal(connected(8.2, 7.5, 4.5, 7.5), false);
});

test("satu ruangan: langsung tersambung penuh berapa pun jaraknya", () => {
  assert.equal(zoneAt(10, -4)?.name, "Ruang Meeting");
  assert.deepEqual(linkIn(d, 10, -4, 6, -11), { distance: 0, volume: 1 });
});

test("meja bersebelahan = area berbeda; datang ke meja = tersambung", () => {
  assert.equal(zoneAt(-14.5, -8.6)?.name, "Meja 1");
  assert.equal(zoneAt(-12.5, -8.6)?.name, "Meja 2");
  assert.equal(connected(-14.5, -8.6, -12.5, -8.6), false);
  assert.equal(connected(-14.5, -8.6, -14.0, -8.4), true);
});

test("ruang fokus A & B terpisah satu sama lain", () => {
  assert.equal(zoneAt(-2.5, -10)?.name, "Ruang Fokus A");
  assert.equal(zoneAt(1.8, -10)?.name, "Ruang Fokus B");
  assert.equal(connected(-1, -10, 0.5, -10), false);
});

test("titik muncul (spawn) tidak berada di dalam area mana pun", () => {
  for (let x = -5; x <= 5; x += 0.5) for (let z = 7; z <= 11; z += 0.5) assert.equal(zoneAt(x, z), null, `${x},${z}`);
});

test("pintu & dinding: celah pintu tidak tertutup dinding", () => {
  const door = d.doors.find((dr) => dr.id === "meeting")!;
  assert.deepEqual([door.orient, door.c], ["x", -2]);
  const south = d.walls.filter((w) => w.orient === "x" && w.c === -2 && w.a[0] >= 4 - 1e-9);
  assert.equal(south.length, 2);
  for (const w of south) assert.ok(w.a[1] <= door.a[0] + 1e-9 || w.a[0] >= door.a[1] - 1e-9);
  // sisi yang menempel dinding luar tidak diberi dinding kaca
  assert.ok(!d.walls.some((w) => w.orient === "z" && w.c === 17.85));
});

test("rotasi: kursi meja kerja ada di depan meja dan menghadap meja", () => {
  assert.deepEqual(toWorld({ x: 0, z: 0, rot: 1 }, 0, 1), [1, 0]);
  const seat = d.seats.find((s) => s.id.startsWith("i1:"))!; // meja kerja pertama (-14.5, -9.5)
  assert.deepEqual([seat.x, seat.z], [-14.5, -8.75]);
  assert.ok(Math.abs(Math.cos(seat.yaw) + 1) < 1e-9); // menghadap -z (ke meja)
});

test("sanitizeLayout menerima denah bawaan & menolak data rusak", () => {
  assert.deepEqual(sanitizeLayout(defaultLayout()), defaultLayout());
  const floor = (items: unknown[]) => ({ floors: [{ id: "f1", name: "L1", rooms: [], areas: [], items }] });
  assert.equal(sanitizeLayout(floor([{ id: "a", type: "rocket", x: 0, z: 0, rot: 0 }])), null);
  assert.equal(sanitizeLayout(floor([{ id: "a", type: "desk", x: 0, z: 0, rot: 0 }, { id: "a", type: "desk", x: 1, z: 0, rot: 0 }])), null);
  // id harus unik di seluruh lantai
  const l = defaultLayout();
  l.floors[1].items[0].id = l.floors[0].items[0].id;
  assert.equal(sanitizeLayout(l), null);
});

test("denah lama (v1, satu lantai) otomatis diubah ke v2", () => {
  const v1 = { rooms: [], areas: [], items: [{ id: "d1", type: "desk", x: 0, z: 0, rot: 0 }] };
  const l = sanitizeLayout(v1)!;
  assert.equal(l.version, 2);
  assert.equal(l.floors.length, 1);
  assert.equal(l.floors[0].items[0].id, "d1");
});

test("panggung town hall (Lantai 1): terdengar oleh semua orang di lantai, kecuali yang di dalam ruangan", () => {
  const stage: [number, number] = [0, -21];
  assert.equal(zoneIn(d, ...stage)?.stage, true);
  assert.equal(zoneIn(d, ...stage)?.name, "Town Hall");
  assert.deepEqual(linkIn(d, 0, -16, ...stage), { distance: 0, volume: 1 }); // penonton di kursi town hall
  assert.deepEqual(linkIn(d, 12, 7.5, ...stage), { distance: 0, volume: 1 }); // di Lounge pun dengar
  assert.equal(linkIn(d, 10.9, -7.5, ...stage).volume, 0); // di Ruang Meeting (ruangan) tidak
  // penonton tidak ikut "disiarkan": yang di panggung tidak mendengar penonton jauh
  assert.equal(linkIn(d, ...stage, 0, -14.6).volume, 0);
});

test("town hall: semua kursi penonton di dalam gedung, di luar ruangan, menghadap panggung", () => {
  const f1 = defaultLayout().floors[0];
  const chairs = f1.items.filter((i) => i.type === "chair" && i.z < -13);
  assert.equal(chairs.length, 45);
  for (const c of chairs) {
    assert.ok(c.z > WORLD.minZ && c.x > WORLD.minX && c.x < WORLD.maxX);
    assert.equal(c.rot, 2);
    assert.notEqual(zoneIn(d, c.x, c.z)?.kind, "room");
  }
  // Ruangan lama yang dulu menempel dinding utara kini berdinding kaca di sisi itu (bukan celah terbuka ke town hall).
  assert.ok(d.walls.some((w) => w.orient === "x" && w.c === -12.85));
});

test("Lantai 2 = arcade: tanpa ruangan & area, ada mesin arcade dan meja Empat Sejajar", () => {
  const f2 = defaultLayout().floors[1];
  assert.equal(f2.rooms.length, 0);
  assert.equal(f2.areas.length, 0);
  assert.equal(f2.items.filter((i) => i.type === "arcade").length, 4);
  assert.equal(f2.items.filter((i) => i.type === "gameTable").length, 4);
  assert.equal(d2.seats.length, 8, "dua kursi per meja");
});

test("lift ada di kedua lantai dengan titik keluar di depan pintunya", () => {
  for (const dd of [d, d2]) {
    assert.equal(dd.elevators.length, 1);
    const e = dd.elevators[0];
    assert.equal(zoneIn(dd, ...e.exit), null);
    assert.ok(Math.hypot(e.exit[0] - e.x, e.exit[1] - e.z) > 1);
  }
});
