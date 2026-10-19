import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultLayout, deriveFloor, ejectPoint } from "../../shared/layout";
import { createController, seatMissing, type ControllerIO, type Motion, type NetView, type Vec3 } from "./controller";
import { doorNear, seatNear, setDerived, zoneAt } from "./zones";
import { ANIM } from "./anims";

const d = deriveFloor(defaultLayout().floors[0]);
setDerived(d);

function fakeMotion(x: number, z: number) {
  const m = {
    p: [x, 0, z] as Vec3,
    v: [0, 0] as [number, number],
    enabled: true,
    position: () => m.p,
    setVelocity(vx: number, vz: number) { m.v = [vx, vz]; },
    teleport(nx: number, nz: number) { m.p = [nx, 0, nz]; },
    setEnabled(on: boolean) { m.enabled = on; },
  };
  return m satisfies Motion & Record<string, unknown>;
}

function fakeIO(state: Partial<NetView> = {}) {
  const calls = { moves: [] as unknown[], doors: [] as [string, boolean][], notices: [] as string[], prox: 0 };
  const st: NetView = { following: null, floor: "f1", players: {}, desks: {}, selfId: "me", zoneId: null, nearDoor: null, nearSeat: null, nearLift: false, nearGame: null, ...state };
  const io: ControllerIO = {
    state: () => st,
    patch: (p) => Object.assign(st, p),
    remote: () => undefined,
    remotes: () => [],
    world: () => d,
    zoneAt,
    doorNear,
    seatNear,
    ejectPoint: (zn, x, z) => ejectPoint(zn, x, z),
    gameNear: () => null,
    openGame: () => {},
    sendMove: (p, r, a) => calls.moves.push([p, r, a]),
    sendDoor: (id, inside) => calls.doors.push([id, inside]),
    updateProximity: () => { calls.prox++; },
    teleportNear: () => {},
    focusNotice: (name) => calls.notices.push(name),
    setSelfPos: () => {},
  };
  return { io, st, calls };
}
const input = (keys: string[] = [], pressed: string[] = [], touch = { x: 0, y: 0 }) => ({ held: new Set(keys), pressed: new Set(pressed), touch });

test("W = maju ke arah pandang kamera; Shift = lari; diagonal tetap 4 m/s", () => {
  const m = fakeMotion(0, 15);
  const c = createController(m, input(["KeyW"]), fakeIO().io);
  c.step(1 / 60, 0, 0);
  assert.deepEqual(m.v.map((v) => Math.round(v * 100) / 100 + 0), [0, -4]); // utara = -z
  c.step(1 / 60, 0, Math.PI / 2); // kamera diputar 90°
  assert.deepEqual(m.v.map((v) => Math.round(v * 100) / 100 + 0), [-4, 0]);
  const run = createController(m, input(["KeyW", "ShiftLeft"]), fakeIO().io);
  run.step(1 / 60, 0, 0);
  assert.equal(Math.round(m.v[1]), -7);
  const diag = createController(m, input(["KeyW", "KeyD"]), fakeIO().io);
  diag.step(1 / 60, 0, 0);
  assert.ok(Math.abs(Math.hypot(...m.v) - 4) < 1e-9);
  assert.equal(diag.anim, ANIM.walk);
});

test("joystick di zona mati tidak menggerakkan avatar", () => {
  const m = fakeMotion(0, 15);
  createController(m, input([], [], { x: 0.1, y: 0 }), fakeIO().io).step(1 / 60, 0, 0);
  assert.deepEqual(m.v, [0, 0]);
});

test("C duduk di kursi terdekat; bergerak = berdiri ke titik berdiri kursi", () => {
  const seat = d.seats[0];
  const m = fakeMotion(seat.x + 0.3, seat.z);
  const inp = input([], ["KeyC"]);
  const { io, st } = fakeIO();
  const c = createController(m, inp, io);
  c.step(1 / 60, 0, 0);
  assert.equal(c.seat?.id, seat.id);
  assert.equal(st.sitting, true);
  assert.equal(m.enabled, false);
  assert.deepEqual([m.p[0], m.p[2]], [seat.x, seat.z]);
  assert.equal(c.anim, ANIM.sit);
  inp.held.add("KeyW");
  c.step(1 / 60, 0.1, 0);
  assert.equal(c.seat, null);
  assert.equal(st.sitting, false);
  assert.deepEqual([m.p[0], m.p[2]], seat.stand);
});

test("F di dekat pintu mengirim aksi pintu (dari luar ruangan)", () => {
  const door = d.doors.find((dr) => dr.id === "divisi-1")!; // pintu selatan Divisi 1 (z = -8.5)
  const m = fakeMotion((door.a[0] + door.a[1]) / 2, door.c + 1);
  const { io, calls } = fakeIO();
  createController(m, input([], ["KeyF"]), io).step(1 / 60, 0, 0);
  assert.deepEqual(calls.doors, [["divisi-1", false]]);
});

test("meja mode fokus milik orang lain: didorong keluar + pemberitahuan", () => {
  const desk = d.zones.find((z) => z.kind === "desk")!;
  if (desk.shape !== "rect") throw new Error("meja harus persegi");
  const cx = (desk.x[0] + desk.x[1]) / 2;
  const cz = (desk.z[0] + desk.z[1]) / 2;
  const m = fakeMotion(cx, cz);
  const { io, calls } = fakeIO({ desks: { [desk.id]: { locked: true, ownerId: "lain", ownerName: "Ani" } } });
  createController(m, input(), io).step(1 / 60, 10, 0);
  assert.equal(zoneAt(m.p[0], m.p[2])?.id === desk.id, false);
  assert.deepEqual(calls.notices, ["Ani"]);
});

test("zona aktif diperbarui; posisi dikirim maks 15×/detik & hanya bila berubah", () => {
  const m = fakeMotion(-23, -9.3); // Divisi 1
  const { io, st, calls } = fakeIO();
  const c = createController(m, input(), io);
  c.step(0.07, 0, 0);
  assert.equal(st.zoneId, "room:divisi-1");
  assert.equal(calls.moves.length, 1);
  c.step(0.07, 0.07, 0); // tidak bergerak → tidak dikirim ulang
  assert.equal(calls.moves.length, 1);
  c.step(0.01, 0.08, 0);
  assert.equal(calls.moves.length, 1);
});

test("berdiri memperbarui posisi diri ke titik berdiri (dipakai mode tampilan berikutnya)", () => {
  const seat = d.seats[0];
  const m = fakeMotion(seat.x + 0.3, seat.z);
  const { io } = fakeIO();
  const selfPos: unknown[] = [];
  io.setSelfPos = (p) => selfPos.push(p);
  const c = createController(m, input([], ["KeyC"]), io);
  c.step(1 / 60, 0, 0);
  c.standUp();
  assert.deepEqual(selfPos.at(-1), [seat.stand[0], 0, seat.stand[1]]);
});

test("seatMissing: kursi yang diduduki hilang dari denah → harus berdiri", () => {
  const seat = d.seats[0];
  assert.equal(seatMissing(seat, d.seats), false);
  assert.equal(seatMissing(seat, d.seats.filter((s) => s.id !== seat.id)), true);
  assert.equal(seatMissing(null, []), false);
});
