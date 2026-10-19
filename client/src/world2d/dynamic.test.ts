import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultLayout, deriveFloor } from "../../../shared/layout";
import { randomAvatar } from "../avatar/config";
import { ANIM } from "../anims";
import { drawDynamic, type DynFrame } from "./dynamic";
import type { Cam } from "./camera";

(globalThis as { devicePixelRatio?: number }).devicePixelRatio = 1;

// Konteks kanvas tiruan: mencatat tiap panggilan beserta argumennya dan tiap nilai fillStyle yang ditulis.
function fakeCtx() {
  const calls: unknown[][] = [];
  const styles: string[] = [];
  const strokes: string[] = [];
  const target: Record<string, unknown> = { canvas: { width: 100, height: 100 } };
  return {
    calls,
    styles,
    strokes,
    g: new Proxy(target, {
      get: (t, k) =>
        k in t
          ? t[k as string]
          : (...a: unknown[]) => (calls.push([String(k), ...a]), k === "measureText" ? { width: 1 } : k === "createLinearGradient" || k === "createRadialGradient" ? { addColorStop() {} } : undefined),
      set: (t, k, v) => {
        if (k === "fillStyle") styles.push(String(v));
        if (k === "strokeStyle") strokes.push(String(v));
        t[k as string] = v;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D,
  };
}

const floor = defaultLayout().floors[0];
const derived = deriveFloor(floor);
const cam: Cam = { x: 0, z: 0, zoom: 1, w: 800, h: 600 };
const body = { id: "me", cfg: randomAvatar(), x: 0, z: 15, facing: 0, anim: ANIM.idle, hand: false };

function frame(over: Partial<DynFrame> = {}): DynFrame {
  return {
    floor,
    derived,
    zone: null,
    self: body,
    others: [],
    ring: { show: false, someone: false },
    t: 0,
    doors: {},
    doorAnim: new Map(),
    desks: {},
    bookings: [],
    screens: new Map(),
    boards: new Map(),
    editor: { selected: null, drag: null },
    ...over,
  };
}

test("pintu terkunci digambar merah, pintu terbuka tidak menggambar daun di celah", () => {
  const [locked, opened] = derived.doors;
  const { g, styles, calls } = fakeCtx();
  drawDynamic(
    g,
    cam,
    frame({
      doors: { [locked.id]: { open: false, locked: true }, [opened.id]: { open: true, locked: false } },
      doorAnim: new Map([[locked.id, 0], [opened.id, 1]]),
    }),
  );
  // satu daun (2 bilah) merah, tepat sekali per pintu terkunci
  assert.equal(styles.filter((s) => s === "#f2a3a6").length, 1);
  // pintu terbuka penuh: tidak ada bilah yang menutupi tengah celah pintu
  const mid = (opened.a[0] + opened.a[1]) / 2;
  const rects = calls.filter((c) => c[0] === "fillRect") as [string, number, number, number, number][];
  const covers = rects.some(([, x, z, w, h]) =>
    opened.orient === "x" ? Math.abs(z + h / 2 - opened.c) < 0.1 && x < mid && x + w > mid : Math.abs(x + w / 2 - opened.c) < 0.1 && z < mid && z + h > mid,
  );
  assert.equal(covers, false);
});

test("label booking & label meja fokus menulis teks", () => {
  const desk = derived.zones.find((z) => z.kind === "desk")!;
  const room = derived.doors[0].id;
  const { g, calls } = fakeCtx();
  drawDynamic(
    g,
    cam,
    frame({
      desks: { [desk.id]: { ownerId: "x", ownerName: "Ani", locked: true, online: true } },
      bookings: [{ room, text: "📅 Rapat mingguan", now: true }],
    }),
  );
  const texts = calls.filter((c) => c[0] === "fillText").map((c) => String(c[1]));
  assert.ok(texts.some((s) => s.includes("Ani")), texts.join(" | "));
  assert.ok(texts.some((s) => s.includes("Rapat mingguan")), texts.join(" | "));
});

test("layar dengan sumber gambar memanggil drawImage; tanpa sumber menggambar layar gelap", () => {
  const screen = floor.items.find((i) => i.type === "screen")!;
  const withSrc = fakeCtx();
  drawDynamic(withSrc.g, cam, frame({ screens: new Map([[screen.id, {} as CanvasImageSource]]) }));
  assert.equal(withSrc.calls.filter((c) => c[0] === "drawImage").length, 1);
  const without = fakeCtx();
  drawDynamic(without.g, cam, frame());
  assert.equal(without.calls.filter((c) => c[0] === "drawImage").length, 0);
  assert.ok(without.styles.includes("#1b1d26"), "bingkai layar gelap tetap digambar");
});

test("editor: item terpilih diberi cincin biru; item yang diseret digambar di posisi seret", () => {
  const desk = floor.items.find((i) => i.type === "desk")!;
  const { g, calls, strokes } = fakeCtx();
  drawDynamic(g, cam, frame({ editor: { selected: desk.id, drag: { id: desk.id, x: desk.x + 3, z: desk.z } } }));
  assert.ok(strokes.includes("#2f80ed"), "cincin pilihan");
  assert.ok(calls.some((c) => c[0] === "translate" && c[1] === desk.x + 3 && c[2] === desk.z), "digambar di posisi seret");
});

test("rak buku (diputar) menutupi avatar yang berdiri tepat di belakangnya — digambar ulang sesudah avatar, ikut rotasinya", () => {
  const shelf = floor.items.find((i) => i.type === "bookshelf" && i.rot !== 0)!;
  const { g, calls } = fakeCtx();
  drawDynamic(g, cam, frame({ self: { ...body, x: shelf.x, z: shelf.z - 0.3 } }));
  const avatarAt = calls.findIndex((c) => c[0] === "scale" && c[1] === 0.012); // drawAvatar menskalakan ke unit gambar
  const again = calls.findIndex((c, i) => i > avatarAt && c[0] === "translate" && c[1] === shelf.x && c[2] === shelf.z);
  assert.ok(avatarAt >= 0 && again > avatarAt, "rak digambar ulang setelah avatar");
  assert.equal(calls[again + 1][0], "rotate");
});

test("label meja/pintu di kanvas tanpa emoji — ikon gembok/kursi/kalender digambar sebagai vektor", () => {
  const desk = derived.zones.find((z) => z.kind === "desk")!;
  const door = derived.doors[0];
  const { g, calls } = fakeCtx();
  drawDynamic(
    g,
    cam,
    frame({
      desks: { [desk.id]: { ownerId: "x", ownerName: "Ani", locked: true, online: true } },
      doors: { [door.id]: { open: false, locked: true } },
      bookings: [{ room: door.id, text: "Rapat mingguan", now: false }],
      lockedText: "Terkunci",
    }),
  );
  const texts = calls.filter((c) => c[0] === "fillText").map((c) => String(c[1]));
  assert.ok(!texts.some((s) => /\p{Extended_Pictographic}/u.test(s)), texts.join(" | "));
  assert.ok(texts.some((s) => s.includes("Ani")) && texts.some((s) => s.includes("Terkunci")));
  assert.ok(calls.some((c) => c[0] === "arc"), "lengkung gembok tergambar");
});
