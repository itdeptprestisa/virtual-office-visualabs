import { test } from "node:test";
import assert from "node:assert/strict";
import { Limiter, tooMany } from "./ratelimit.js";

test("limiter: blokir setelah batas, lepas setelah jendela waktu, reset menghapus hitungan", () => {
  const l = new Limiter(3, 1000);
  for (let i = 0; i < 3; i++) {
    assert.equal(l.blocked("a", 0), 0);
    l.hit("a", 0);
  }
  assert.equal(l.blocked("a", 100), 900);
  assert.equal(l.blocked("b", 100), 0, "kunci lain tidak ikut terblokir");
  assert.equal(l.blocked("a", 1000), 0, "jendela lewat → boleh lagi");
  l.hit("a", 1000);
  assert.equal(l.blocked("a", 1001), 0, "hitungan mulai dari nol di jendela baru");
  l.hit("c", 0);
  l.hit("c", 0);
  l.hit("c", 0);
  l.reset("c");
  assert.equal(l.blocked("c", 1), 0);
  l.prune(5000);
  assert.equal(l.blocked("a", 1001), 0);
});

test("pesan blokir dibulatkan ke atas dalam menit, minimal 1", () => {
  assert.equal(tooMany(1), "Terlalu banyak percobaan. Coba lagi dalam 1 menit.");
  assert.equal(tooMany(14 * 60_000 + 1), "Terlalu banyak percobaan. Coba lagi dalam 15 menit.");
});
