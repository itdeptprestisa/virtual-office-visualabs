import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DECORATION_MOVES, DECORATION_TYPES, DECORATION_TYPES_2, defaultLayout, isDecoration1, isDecoration2, type Layout } from "../../shared/layout";

// Migrasi data: denah yang tersimpan sebelum ada dekorasi dilengkapi sekali saja saat server start.

const dir = mkdtempSync(join(tmpdir(), "vo-migrate-"));
const DATA_FILE = join(dir, "db.json");
const isDeco = (t: string) => ([...DECORATION_TYPES, ...DECORATION_TYPES_2] as readonly string[]).includes(t);
const decoCount = (l: Layout) => l.floors.flatMap((f) => f.items).filter((i) => isDeco(i.type)).length;

after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3 }));

async function runServer() {
  const port = 27670 + Math.floor(Math.random() * 1000);
  const server: ChildProcess = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, PORT: String(port), DATA_FILE },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    server.stdout!.on("data", (d) => String(d).includes("jalan di") && resolve());
    setTimeout(() => reject(new Error("server tidak start")), 15000);
  });
  await new Promise((r) => setTimeout(r, 800)); // simpan ke disk dijadwalkan 500 ms
  const exited = new Promise((r) => server.once("exit", r));
  server.kill();
  await exited;
  return JSON.parse(readFileSync(DATA_FILE, "utf8"));
}

test("penghalang di persimpangan lorong pada denah tersimpan dipindah sekali", async () => {
  const def = defaultLayout();
  const old: Layout = {
    ...def,
    floors: def.floors.map((f) => ({
      ...f,
      items: f.items.map((i) => {
        const m = DECORATION_MOVES.find((mv) => mv.type === i.type && mv.to[0] === i.x && mv.to[1] === i.z);
        return m ? { ...i, x: m.from[0], z: m.from[1] } : i;
      }),
    })),
  };
  writeFileSync(DATA_FILE, JSON.stringify({ layout: old, migrations: ["dekorasi-2026-10", "dekorasi-2026-10b"] }));
  const after: Layout = (await runServer()).layout;
  for (const m of DECORATION_MOVES) {
    assert.ok(!after.floors[0].items.some((i) => i.type === m.type && i.x === m.from[0] && i.z === m.from[1]), `${m.type} masih di persimpangan`);
    assert.ok(after.floors[0].items.some((i) => i.type === m.type && i.x === m.to[0] && i.z === m.to[1]), `${m.type} tidak di posisi baru`);
  }
});

test("denah yang sudah punya dekorasi gelombang pertama mendapat gelombang kedua saja", async () => {
  const def = defaultLayout();
  const old: Layout = { ...def, floors: def.floors.map((f) => ({ ...f, items: f.items.filter((i) => !isDecoration2(i)) })) };
  writeFileSync(DATA_FILE, JSON.stringify({ layout: old, migrations: ["dekorasi-2026-10"] }));
  const after = await runServer();
  assert.equal(decoCount(after.layout), decoCount(def));
});

test("denah lama tanpa dekorasi dilengkapi sekali; dekorasi yang dihapus admin tidak muncul lagi", async () => {
  const def = defaultLayout();
  const old: Layout = { ...def, floors: def.floors.map((f) => ({ ...f, items: f.items.filter((i) => !isDecoration1(i) && !isDecoration2(i)) })) };
  writeFileSync(DATA_FILE, JSON.stringify({ layout: old }));

  const first = await runServer();
  assert.equal(decoCount(first.layout), decoCount(def));

  // admin menghapus semua dekorasi → restart server → tetap tanpa dekorasi
  first.layout = old;
  writeFileSync(DATA_FILE, JSON.stringify(first));
  const second = await runServer();
  assert.equal(decoCount(second.layout), 0);
});
