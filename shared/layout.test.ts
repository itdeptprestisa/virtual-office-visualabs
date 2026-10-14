import { test } from "node:test";
import assert from "node:assert/strict";
import { PROXIMITY, defaultLayout, derive, linkIn, sanitizeLayout, toWorld, zoneIn } from "./layout";

const d = derive(defaultLayout());
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
  assert.equal(sanitizeLayout({ rooms: [], areas: [], items: [{ id: "a", type: "rocket", x: 0, z: 0, rot: 0 }] }), null);
  assert.equal(sanitizeLayout({ rooms: [], areas: [], items: [{ id: "a", type: "desk", x: 0, z: 0, rot: 0 }, { id: "a", type: "desk", x: 1, z: 0, rot: 0 }] }), null);
});
