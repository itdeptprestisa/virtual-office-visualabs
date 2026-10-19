import { test } from "node:test";
import assert from "node:assert/strict";
import { ZOOM_MAX, ZOOM_MIN, pinchZoom } from "./camera";

test("pinch: jari melebar = zoom masuk sebanding jarak, menyempit = zoom keluar, dibatasi min/maks", () => {
  assert.equal(pinchZoom(1, 100, 200), 2);
  assert.equal(pinchZoom(1, 200, 100), 0.5);
  assert.equal(pinchZoom(2, 100, 400), ZOOM_MAX);
  assert.equal(pinchZoom(1, 400, 10), ZOOM_MIN);
  assert.equal(pinchZoom(1.3, 0, 50), 1.3); // jarak awal 0 (dua jari di titik yang sama) → tidak berubah
});
