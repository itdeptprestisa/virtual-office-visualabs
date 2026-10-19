import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_LAYER_PIXELS, followCam, planLayer, shouldRedraw } from "./layerPlan";
import { BASE_PX, ZOOM_MIN, clampZoom, fitZoom, type Cam } from "./camera";
import { WORLD } from "../../../shared/layout";

const IOS_LIMIT = 16_777_216; // batas luas kanvas iOS Safari

test("ukuran lapisan diam tidak melewati batas piksel (iPhone dpr 3, iPad dpr 2, desktop 4K)", () => {
  for (const [w, h, dpr] of [
    [390, 844, 3],
    [1024, 1366, 2],
    [1920, 1080, 2],
    [3840, 2160, 1],
  ]) {
    const plan = planLayer({ x: 0, z: 0, zoom: 1, w, h }, dpr);
    const px = Math.ceil((plan.rect.x1 - plan.rect.x0) * plan.scale) * Math.ceil((plan.rect.z1 - plan.rect.z0) * plan.scale);
    assert.ok(px <= MAX_LAYER_PIXELS && px < IOS_LIMIT, `${w}×${h}@${dpr}: ${px} px`);
  }
});

test("lapisan diam tetap menutupi seluruh layar", () => {
  const cam: Cam = { x: 5, z: -3, zoom: 1.5, w: 390, h: 844 };
  const { rect } = planLayer(cam, 3);
  const hw = cam.w / 2 / (48 * cam.zoom);
  const hh = cam.h / 2 / (48 * cam.zoom);
  assert.ok(rect.x0 <= cam.x - hw && rect.x1 >= cam.x + hw && rect.z0 <= cam.z - hh && rect.z1 >= cam.z + hh);
});

test("zoom berjalan: lapisan lama diskalakan dulu, digambar ulang setelah zoom berhenti ±150 ms", () => {
  const base = { dirty: false, inside: true, keyChanged: false, scaleChanged: true };
  assert.equal(shouldRedraw({ ...base, sinceScaleChange: 30 }), false);
  assert.equal(shouldRedraw({ ...base, sinceScaleChange: 200 }), true);
  assert.equal(shouldRedraw({ ...base, scaleChanged: false, sinceScaleChange: 30 }), false);
  // keluar area cache / denah berubah / dibatalkan → langsung digambar ulang
  assert.equal(shouldRedraw({ ...base, inside: false, sinceScaleChange: 30 }), true);
  assert.equal(shouldRedraw({ ...base, keyChanged: true, sinceScaleChange: 30 }), true);
  assert.equal(shouldRedraw({ ...base, dirty: true, sinceScaleChange: 30 }), true);
});

test("kamera: menyusul halus, tapi loncat langsung bila lompatan > 5 m (teleport/lift)", () => {
  const c: Cam = { x: 0, z: 0, zoom: 1, w: 800, h: 600 };
  followCam(c, 1, 0, 1 / 60);
  assert.ok(c.x > 0 && c.x < 1);
  followCam(c, 40, 10, 1 / 60);
  assert.deepEqual([c.x, c.z], [40, 10]);
});

test("zoom paling jauh memuat seluruh lantai di laptop & HP; layar sangat besar tetap dibatasi ZOOM_MIN", () => {
  for (const [w, h] of [[1280, 800], [1920, 1080], [390, 844]]) {
    const c: Cam = { x: 0, z: 0, zoom: 1, w, h };
    const z = clampZoom(c, 0.01);
    assert.ok(z <= fitZoom(c) + 1e-9, `${w}×${h}`);
    assert.ok(w / (BASE_PX * z) >= WORLD.maxX - WORLD.minX && h / (BASE_PX * z) >= WORLD.maxZ - WORLD.minZ, `${w}×${h}: gedung muat`);
  }
  assert.equal(clampZoom({ x: 0, z: 0, zoom: 1, w: 8000, h: 8000 }, 0.01), ZOOM_MIN);
});

test("kamera: zoom biasa mengikuti avatar, zoom paling jauh berpusat di tengah gedung", () => {
  const near: Cam = { x: -20, z: -30, zoom: 1, w: 1280, h: 800 };
  for (let i = 0; i < 300; i++) followCam(near, -20, -30, 1 / 60);
  assert.deepEqual([Math.round(near.x), Math.round(near.z)], [-20, -30]);
  const far: Cam = { x: -20, z: -30, zoom: 1, w: 1280, h: 800 };
  far.zoom = clampZoom(far, 0.01);
  for (let i = 0; i < 300; i++) followCam(far, -20, -30, 1 / 60);
  assert.ok(Math.abs(far.x - (WORLD.minX + WORLD.maxX) / 2) < 0.01 && Math.abs(far.z - (WORLD.minZ + WORLD.maxZ) / 2) < 0.01);
});
