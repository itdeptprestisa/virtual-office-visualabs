import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EN } from "./i18n.en";
import { LABELS } from "./avatar/config";
import { ITEM_LABELS } from "../../shared/layout";

// Setiap teks UI harus punya terjemahan bahasa Inggris — supaya tidak ada yang tertinggal saat menambah fitur.

const root = fileURLToPath(new URL("..", import.meta.url)); // client/
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(f) && !f.includes(".test.") && !f.startsWith("i18n") ? [p] : [];
  });

const literalKeys = new Set<string>();
for (const f of files(join(root, "src"))) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bt\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g)) literalKeys.add(m[1] ?? m[2]);
}

// Teks dari server yang ditampilkan client (alasan gagal masuk, pemberitahuan, alasan dikeluarkan).
const serverSrc = readFileSync(join(root, "../server/src/index.ts"), "utf8");
const serverKeys = [...serverSrc.matchAll(/(?:authError\(|reason: |text: )"([^"]+)"/g)].map((m) => m[1]);

// Teks yang diterjemahkan lewat variabel.
const dynamicKeys = [
  ...Object.values(LABELS),
  ...Object.values(ITEM_LABELS),
  ...["Tersedia", "Sibuk", "Fokus", "Rapat", "Away", "Offline"], // STATUS
  ...["Tubuh", "Warna kulit", "Hijab", "Rambut", "Atasan", "Bawahan", "Sepatu", "Kacamata", "Topi"], // baris editor avatar
  ...["Diam", "Jalan", "Lambai", "Joget"], // animasi pratinjau
  ...["Buka", "Tutup", "Ketuk", "Kunci", "Buka kunci"], // aksi pintu
  ...["Tidak bisa terhubung ke server.", "Kantor sedang penuh, coba lagi nanti.", "Upload kelamaan, coba lagi.", "File tidak bisa dibaca."],
  ...["Ruang Meeting", "Ruang Fokus A", "Ruang Fokus B", "Ruang Kolaborasi", "Lounge", "Pantry", "Panggung Aula", "Taman Atap", "Sekitar"],
];

test("semua teks UI di kode client punya terjemahan Inggris", () => {
  assert.ok(literalKeys.size > 200, `hanya ${literalKeys.size} kunci ditemukan — regex rusak?`);
  const missing = [...literalKeys].filter((k) => !(k in EN));
  assert.deepEqual(missing, []);
});

test("teks dari server punya terjemahan Inggris", () => {
  assert.ok(serverKeys.length > 15);
  assert.deepEqual(serverKeys.filter((k) => !(k in EN)), []);
});

test("label pilihan (avatar, furnitur, status, nama tempat) punya terjemahan Inggris", () => {
  assert.deepEqual([...new Set(dynamicKeys)].filter((k) => !(k in EN)), []);
});

test("variabel {…} di terjemahan sama dengan di teks asli", () => {
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  const bad = Object.entries(EN).filter(([id, en]) => vars(id) !== vars(en));
  assert.deepEqual(bad, []);
});
