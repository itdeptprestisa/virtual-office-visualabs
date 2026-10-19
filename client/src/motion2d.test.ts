import { test } from "node:test";
import assert from "node:assert/strict";
import { WORLD, defaultLayout, deriveFloor } from "../../shared/layout";
import { Grid, RADIUS, buildObstacles, createMotion2D, slide } from "./motion2d";

const f1 = defaultLayout().floors[0];
const d = deriveFloor(f1);
const grid = (doors: Record<string, { open: boolean }> = {}) => new Grid(buildObstacles(f1, d, doors));
const near = (a: number, b: number, eps = 0.02) => Math.abs(a - b) <= eps;

test("dinding kaca menghalangi: berhenti RADIUS di depan dinding selatan Divisi 1", () => {
  const [x, z] = slide(grid(), -28, -7.5, 0, -3); // menuju dinding z = -8.5, jauh dari pintu (x -24.2..-21.8)
  assert.equal(x, -28);
  assert.ok(near(z, -8.5 + 0.05 + RADIUS), `z = ${z}`);
});

test("celah pintu terbuka bisa dilewati; pintu tertutup menghalangi", () => {
  const [, zOpen] = slide(grid(), -23, -7.5, 0, -2.5);
  assert.ok(zOpen < -9.5, `lewat pintu: z = ${zOpen}`);
  const [, zShut] = slide(grid({ "divisi-1": { open: false } }), -23, -7.5, 0, -2.5);
  assert.ok(zShut > -8.5, `pintu tertutup: z = ${zShut}`);
});

test("menabrak dinding miring tetap meluncur menyusuri dinding", () => {
  const [x, z] = slide(grid(), -28, -7.5, -1.5, -1.5);
  assert.ok(near(x, -29.5), `x tetap bergerak: ${x}`);
  assert.ok(z > -8.5);
});

test("dinding luar gedung menghalangi", () => {
  const [x] = slide(grid(), WORLD.maxX - 1, 0, 3, 0);
  assert.ok(x <= WORLD.maxX - 0.15 - RADIUS + 1e-9, `x = ${x}`);
});

test("furnitur padat menghalangi, kursi tidak", () => {
  const desk = f1.items.find((i) => i.type === "desk" && i.x === -30.2 && i.z === -14.9)!;
  const [, z] = slide(grid(), desk.x, desk.z - 2, 0, 2); // dari utara menuju meja (setengah kedalaman 0,45)
  assert.ok(z < desk.z - 0.45, `tertahan meja: z = ${z}`);
  const chair = f1.items.find((i) => i.type === "chair")!;
  const [cx, cz] = slide(grid(), chair.x - 1, chair.z, 2, 0);
  assert.ok(near(cx, chair.x + 1) && cz === chair.z);
});

test("mulai di dalam penghalang (teleport/berdiri) tetap bisa keluar", () => {
  const desk = f1.items.find((i) => i.type === "desk")!;
  const [x, z] = slide(grid(), desk.x, desk.z, 0, 2);
  assert.ok(z > desk.z + 1.9, `keluar: ${x},${z}`);
});

test("pintu tertutup saat berdiri di celahnya: boleh keluar ke dua sisi", () => {
  const door = d.doors.find((dr) => dr.id === "divisi-1")!;
  const g = grid({ "divisi-1": { open: false } });
  const mid = (door.a[0] + door.a[1]) / 2;
  assert.ok(slide(g, mid, door.c, 0, 1)[1] > door.c + 0.9);
  assert.ok(slide(g, mid, door.c, 0, -1)[1] < door.c - 0.9);
});

test("integrate membatasi dt besar (tab baru dibuka lagi) supaya tidak menembus dinding", () => {
  const g = grid();
  const m = createMotion2D(() => g, [-28, -7.5]);
  m.setVelocity(0, -7);
  m.integrate(5); // 5 detik → dibatasi 0,1 detik
  assert.ok(m.position()[2] > -8.5);
  m.setEnabled(false);
  m.integrate(0.1);
  assert.deepEqual(m.position(), [-28, 0, m.position()[2]]);
});

test("sudah menempel dinding kaca (teleport/berdiri) tidak bisa menembusnya", () => {
  // dinding selatan Divisi 1 di z = -8.5; mulai 0,25 m di selatannya (lingkaran avatar sudah menyentuh dinding)
  const [, z] = slide(grid(), -28, -8.5 + 0.25, 0, -2);
  assert.ok(z > -8.5, `menembus dinding: z = ${z}`);
  const [, back] = slide(grid(), -28, -8.5 + 0.25, 0, 1); // menjauh tetap boleh
  assert.ok(back > -8.5 + 1.2, `tidak bisa menjauh: z = ${back}`);
});

test("berdiri di samping pintu lalu pintu ditutup: tidak bisa masuk", () => {
  const door = d.doors.find((dr) => dr.id === "divisi-1")!;
  const mid = (door.a[0] + door.a[1]) / 2;
  const [, z] = slide(grid({ "divisi-1": { open: false } }), mid, door.c + 0.3, 0, -2);
  assert.ok(z > door.c, `masuk lewat pintu tertutup: z = ${z}`);
});

test("rebuild penghalang mengikuti denah baru (meja dipindah)", () => {
  const desk = f1.items.find((i) => i.type === "desk")!;
  const moved = { ...f1, items: f1.items.map((i) => (i.id === desk.id ? { ...i, x: i.x + 3 } : i)) };
  const g2 = new Grid(buildObstacles(moved, deriveFloor(moved), {}));
  assert.equal(g2.query(desk.x - 0.1, desk.z - 0.1, desk.x + 0.1, desk.z + 0.1).some((b) => b.x0 <= desk.x && b.x1 >= desk.x && b.z0 <= desk.z && b.z1 >= desk.z), false);
  assert.ok(g2.query(desk.x + 2.9, desk.z - 0.1, desk.x + 3.1, desk.z + 0.1).length > 0);
});
