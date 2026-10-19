import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultLayout } from "../../../shared/layout";
import { hitItem } from "./editor2d";

const items = defaultLayout().floors[0].items;

test("klik tepat di furnitur memilihnya; di lantai kosong tidak memilih apa pun", () => {
  const desk = items.find((i) => i.type === "desk")!;
  assert.equal(hitItem(items, desk.x + 0.2, desk.z)?.id, desk.id);
  assert.equal(hitItem(items, 0, 16), null); // titik muncul
});

test("item bertumpuk: yang lebih kecil (mis. kursi di atas karpet) yang terpilih", () => {
  const coffee = items.find((i) => i.type === "coffeeTable")!; // di tengah karpet lounge
  assert.equal(hitItem(items, coffee.x, coffee.z)?.type, "coffeeTable");
});
