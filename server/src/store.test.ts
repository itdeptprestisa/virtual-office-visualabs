import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// store.ts membaca DATA_FILE saat di-import → set dulu ke folder sementara, baru import.
const dir = mkdtempSync(join(tmpdir(), "vo-store-"));
process.env.DATA_FILE = join(dir, "db.json");
const { db, flush, sweepUploads, UPLOAD_DIR } = await import("./store.js");

const HOUR = 3600_000;
const now = Date.now();

function upload(id: string, ageMs: number) {
  writeFileSync(join(UPLOAD_DIR, id), "x");
  db.files[id] = { id, name: `${id}.png`, mime: "image/png", size: 1, by: "u1", ts: now - ageMs };
}
const msg = (id: string, fileId: string) => ({ id, from: "u1", name: "A", text: "", ts: now, file: { id: fileId, name: "f", mime: "image/png", size: 1 } });

test("sweepUploads: hapus lampiran lama yang tak dirujuk; yang dipakai & yang baru tetap", () => {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  upload("dipakaiumum", 48 * HOUR);
  upload("dipakaidm", 48 * HOUR);
  upload("yatimlama", 48 * HOUR); // pesannya sudah tergeser batas riwayat
  upload("yatimbaru", 1 * HOUR); // mis. lampiran chat Area / baru di-upload
  db.umum.push(msg("m1", "dipakaiumum"));
  db.dms["u1|u2"] = [msg("m2", "dipakaidm")];

  // File di disk tanpa catatan: yang lama dibersihkan, yang baru dibiarkan.
  writeFileSync(join(UPLOAD_DIR, "sisalama"), "x");
  utimesSync(join(UPLOAD_DIR, "sisalama"), new Date(now - 48 * HOUR), new Date(now - 48 * HOUR));
  writeFileSync(join(UPLOAD_DIR, "sisabaru"), "x");

  assert.equal(sweepUploads(now), 2);
  for (const id of ["dipakaiumum", "dipakaidm", "yatimbaru"]) {
    assert.ok(db.files[id], `${id} tetap tercatat`);
    assert.ok(existsSync(join(UPLOAD_DIR, id)), `${id} tetap di disk`);
  }
  assert.equal(db.files.yatimlama, undefined);
  assert.ok(!existsSync(join(UPLOAD_DIR, "yatimlama")));
  assert.ok(!existsSync(join(UPLOAD_DIR, "sisalama")));
  assert.ok(existsSync(join(UPLOAD_DIR, "sisabaru")));

  assert.equal(sweepUploads(now), 0, "jalan kedua tidak menghapus apa-apa lagi");
  assert.equal(sweepUploads(now + 25 * HOUR), 2, "lewat 24 jam, yatim baru & sisa baru ikut terhapus");
  flush();
  rmSync(dir, { recursive: true, force: true });
});
