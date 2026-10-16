import { test } from "node:test";
import assert from "node:assert/strict";
import { C4_COLS, c4Drop, c4Empty, c4Line, c4Result } from "./connect4";

test("empat sejajar: keping jatuh ke bawah, kolom penuh ditolak", () => {
  const b = c4Empty();
  assert.equal(c4Drop(b, 3, 1), 5);
  assert.equal(c4Drop(b, 3, 2), 4);
  for (let i = 0; i < 4; i++) c4Drop(b, 3, 1);
  assert.equal(c4Drop(b, 3, 2), -1, "kolom penuh");
  assert.equal(c4Drop(b, 7, 1), -1, "kolom di luar papan");
  assert.equal(c4Drop(b, 1.5, 1), -1, "kolom bukan bilangan bulat");
});

test("empat sejajar: menang mendatar, menurun, diagonal; seri bila penuh", () => {
  const h = c4Empty();
  for (const c of [0, 1, 2]) c4Drop(h, c, 1);
  assert.equal(c4Result(h), 0);
  c4Drop(h, 3, 1);
  assert.equal(c4Result(h), 1);

  const v = c4Empty();
  for (let i = 0; i < 4; i++) c4Drop(v, 6, 2);
  assert.equal(c4Result(v), 2);

  // Diagonal naik ke kanan untuk merah (1): tangga keping kuning sebagai penyangga.
  const d = c4Empty();
  for (const [c, fill] of [[0, 0], [1, 1], [2, 2], [3, 3]] as const) {
    for (let i = 0; i < fill; i++) c4Drop(d, c, 2);
    c4Drop(d, c, 1);
  }
  assert.equal(c4Result(d), 1);
  assert.equal(c4Line(d)?.length, 4);

  // Papan penuh tanpa pemenang: pola kolom 2-2 bergantian per baris.
  const full = c4Empty().map((_, i) => {
    const r = Math.floor(i / C4_COLS);
    const c = i % C4_COLS;
    return ((Math.floor(c / 2) + r) % 2) + 1;
  });
  assert.equal(c4Result(full), 3);
});
