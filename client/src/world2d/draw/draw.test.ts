import { test } from "node:test";
import assert from "node:assert/strict";
import { ITEM_TYPES } from "../../../../shared/layout";
import { DRAW, drawItem } from "./furniture";
import { dirOf, drawAvatar } from "./avatar";
import { randomAvatar } from "../../avatar/config";
import { ANIM } from "../../anims";

// Konteks kanvas tiruan: semua method jadi no-op yang mencatat panggilan, properti bebas ditulis.
function fakeCtx() {
  const calls: string[] = [];
  const target: Record<string, unknown> = { canvas: { width: 100, height: 100 } };
  return {
    calls,
    g: new Proxy(target, {
      get: (t, k) => (k in t ? t[k as string] : (...a: unknown[]) => (calls.push(String(k)), k === "measureText" ? { width: 10 } : k === "createLinearGradient" || k === "createRadialGradient" ? { addColorStop() {} } : undefined)),
      set: (t, k, v) => ((t[k as string] = v), true),
    }) as unknown as CanvasRenderingContext2D,
  };
}

test("semua jenis furnitur punya gambar 2D yang benar-benar menggambar", () => {
  for (const type of ITEM_TYPES) {
    assert.equal(typeof DRAW[type], "function", type);
    const { g, calls } = fakeCtx();
    drawItem(g, { id: "x", type, x: 1, z: 2, rot: 1 });
    assert.ok(calls.some((c) => c === "fill" || c === "fillRect" || c === "stroke" || c === "fillText"), `${type} tidak menggambar apa pun`);
    assert.equal(calls.filter((c) => c === "save").length, calls.filter((c) => c === "restore").length, `${type}: save/restore tidak seimbang`);
  }
});

test("arah hadap avatar: 0 = depan (selatan), π = belakang, ±π/2 = samping", () => {
  assert.equal(dirOf(0), "d");
  assert.equal(dirOf(Math.PI), "u");
  assert.equal(dirOf(Math.PI / 2), "r");
  assert.equal(dirOf(-Math.PI / 2), "l");
});

test("avatar tergambar untuk semua animasi & dengan/ tanpa hijab", () => {
  for (const hijab of [false, true])
    for (const anim of Object.values(ANIM)) {
      const { g, calls } = fakeCtx();
      drawAvatar(g, { ...randomAvatar(), hijab }, 0, 0, 0, anim, 0.5, anim === ANIM.wave);
      assert.ok(calls.includes("fill"));
    }
});

test("bayangan furnitur tetap ada berapa pun rotasinya (blur dari skala transform, bukan komponen a saja)", async () => {
  const { shadowed } = await import("./prim");
  for (const [a, b] of [[48, 0], [0, 48], [-48, 0], [0, -48]]) {
    const target: Record<string, unknown> = { getTransform: () => ({ a, b, c: -b, d: a }), save() {}, restore() {} };
    const g = target as unknown as CanvasRenderingContext2D;
    let blur = -1;
    shadowed(g, () => (blur = target.shadowBlur as number));
    assert.ok(Math.abs(blur - 0.12 * 48) < 1e-9, `a=${a} b=${b}: blur ${blur}`);
  }
});
