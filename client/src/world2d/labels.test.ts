import { test } from "node:test";
import assert from "node:assert/strict";
import { placeLabels } from "./labels";

const el = () => ({ style: { transform: "", visibility: "" } });

test("label diletakkan di atas kepala tiap avatar yang tergambar; label tanpa avatar (belum ada data posisi) disembunyikan", () => {
  const els = new Map([["a", el()], ["b", el()]]);
  placeLabels(els, [{ id: "a", x: 1, z: 2, sit: false }], (x, z) => [x * 10, z * 10]);
  assert.equal(els.get("a")!.style.visibility, "visible");
  assert.match(els.get("a")!.style.transform, /^translate\(10px, \d+(\.\d+)?px\)/);
  assert.equal(els.get("b")!.style.visibility, "hidden");
});

test("avatar duduk: label lebih rendah daripada saat berdiri", () => {
  const els = new Map([["a", el()]]);
  const y = (sit: boolean) => {
    placeLabels(els, [{ id: "a", x: 0, z: 0, sit }], (x, z) => [x, z * 100]);
    return Number(/translate\([^,]+, (-?[\d.]+)px\)/.exec(els.get("a")!.style.transform)![1]);
  };
  assert.ok(y(true) > y(false));
});
