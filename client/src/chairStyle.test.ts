import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultLayout } from "../../shared/layout";
import { chairStyles } from "./chairStyle";

test("kursi ruang pimpinan: 1 kursi pimpinan per ruang manager/CEO/COO, sisanya kursi tamu; kursi lain tetap biasa", () => {
  const floor = defaultLayout().floors[0];
  const styles = chairStyles(floor);
  const inRoom = (id: string) => [...styles].filter(([itemId]) => {
    const it = floor.items.find((x) => x.id === itemId)!;
    const r = floor.rooms.find((x) => x.id === id)!;
    return it.x >= r.x[0] && it.x <= r.x[1] && it.z >= r.z[0] && it.z <= r.z[1];
  });
  for (const id of ["ceo", "coo", "manager-1", "manager-6"]) {
    const list = inRoom(id);
    assert.equal(list.filter(([, s]) => s.style === "exec").length, 1, `${id}: tepat satu kursi pimpinan`);
    assert.ok(list.some(([, s]) => s.style === "guest"), `${id}: ada kursi tamu`);
    assert.ok(list.every(([, s]) => s.leather === (id.startsWith("manager") ? "cognac" : "black")), `${id}: warna kulit`);
  }
  // Kursi town hall & ruang rapat tidak berubah.
  assert.equal(inRoom("townhall").length, 0);
  assert.equal(inRoom("rapat-1").length, 0);
});
