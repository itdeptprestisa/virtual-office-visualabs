import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

// Tes end-to-end di browser sungguhan: server + client dev dinyalakan di port acak dengan database sementara,
// lalu dua user menjalankan alur utama. Butuh Chrome/Chromium terpasang (atau CHROME_PATH).
//   bun run test:e2e

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SERVER_PORT = 31000 + Math.floor(Math.random() * 1000);
const CLIENT_PORT = SERVER_PORT + 1000;
const URL_ = `http://localhost:${CLIENT_PORT}`;
const VIEW = process.env.E2E_VIEW === "3d" ? "3d" : "2d"; // mode tampilan yang diuji (bawaan 2D)
const CHROME =
  process.env.CHROME_PATH ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].find(existsSync);

const dir = mkdtempSync(join(tmpdir(), "vo-e2e-"));
const procs: ChildProcess[] = [];
let browser: Browser;

function start(cmd: string, args: string[], cwd: string, env: Record<string, string>, ready: RegExp) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    procs.push(p);
    const onData = (d: Buffer) => ready.test(String(d)) && resolve();
    p.stdout!.on("data", onData);
    p.stderr!.on("data", onData);
    setTimeout(() => reject(new Error(`${cmd} ${args.join(" ")} tidak siap`)), 30_000);
  });
}

before(async () => {
  if (!CHROME) throw new Error("Chrome tidak ditemukan — set CHROME_PATH");
  await start(process.execPath, ["src/index.ts"], join(ROOT, "server"), { PORT: String(SERVER_PORT), DATA_FILE: join(dir, "db.json") }, /jalan di/);
  await start(process.execPath, ["--bun", join(ROOT, "node_modules/vite/bin/vite.js"), "--port", String(CLIENT_PORT), "--strictPort"], join(ROOT, "client"), { VITE_SERVER_URL: `ws://localhost:${SERVER_PORT}` }, /Local:/);
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
});

after(async () => {
  await browser?.close();
  await Promise.all(procs.map((p) => new Promise((r) => (p.exitCode !== null ? r(null) : (p.once("exit", r), p.kill())))));
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

const errors: string[] = [];

async function open(lang = "id"): Promise<Page> {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: 1100, height: 700 });
  p.on("pageerror", (e) => errors.push(e.message));
  await p.evaluateOnNewDocument(
    (l, v) => {
      localStorage.setItem("vo-lang", l);
      localStorage.setItem("vo-view", v);
    },
    lang,
    VIEW,
  );
  await p.goto(URL_, { waitUntil: "load" });
  await p.waitForSelector(".auth");
  return p;
}

async function clickText(p: Page, sel: string, text: string) {
  for (const el of await p.$$(sel)) if ((await el.evaluate((e) => e.textContent ?? "")).includes(text)) return el.click();
  throw new Error(`"${text}" tidak ditemukan di ${sel}`);
}

async function signUp(p: Page, username: string, name: string) {
  await clickText(p, ".tabs .tab", "Daftar");
  const inputs = await p.$$(".auth input");
  await inputs[0].type(username);
  await inputs[1].type(name);
  await inputs[2].type("rahasia123");
  await p.click(".auth .primary");
  await p.waitForSelector(".editor", { timeout: 20_000 });
  await clickText(p, ".editor .primary", "Masuk ke kantor");
  await p.waitForFunction(() => typeof (window as any).__vo?.teleport === "function", { timeout: 90_000 });
}

const state = <T>(p: Page, fn: (s: any) => T) => p.evaluate((src) => new Function("s", `return (${src})(s)`)((window as any).__vo.useNet.getState()), fn.toString()) as Promise<T>;

let ayu: Page;
let bima: Page;

test("daftar → buat avatar → masuk kantor; pendaftar pertama jadi admin", async () => {
  ayu = await open();
  await signUp(ayu, "ayu", "Ayu");
  bima = await open();
  await signUp(bima, "bima", "Bima");
  assert.equal(await state(ayu, (s) => s.me.role), "admin");
  assert.equal(await state(bima, (s) => s.me.role), "member");
  await ayu.waitForFunction(() => (window as any).__vo.useNet.getState().directory.filter((u: any) => u.online).length === 2);
});

test("chat Umum sampai ke orang lain; DM tersimpan", async () => {
  await ayu.evaluate(async () => (await import("/src/net.ts" as string)).sendChat("umum", "halo dari e2e"));
  await bima.waitForFunction(() => (window as any).__vo.useNet.getState().chat.umum.some((m: any) => m.text === "halo dari e2e"));
  const ayuId = await state(ayu, (s) => s.selfId);
  await bima.evaluate(async (id) => (await import("/src/net.ts" as string)).sendDm(id, "psst"), ayuId);
  await ayu.waitForFunction(() => Object.values((window as any).__vo.useNet.getState().dms).flat().some((m: any) => m.text === "psst"));
});

test("lantai 2: main Empat Sejajar & Snake; avatar diam selama jendela game terbuka", async () => {
  await ayu.bringToFront();
  await ayu.evaluate(() => (window as any).__vo.teleport(31.3, 22.3));
  await ayu.waitForSelector(".lift button");
  await clickText(ayu, ".lift button", "Lantai 2");
  await ayu.waitForFunction(() => (window as any).__vo.useNet.getState().floor === "f2");
  await bima.waitForFunction(() => Object.values((window as any).__vo.useNet.getState().players).some((p: any) => p.name === "Ayu" && p.floor === "f2"));

  await ayu.evaluate(() => (window as any).__vo.teleport(-8, -13.2)); // depan meja Empat Sejajar
  await ayu.waitForFunction(() => (window as any).__vo.useNet.getState().nearGame?.type === "gameTable", { timeout: 20_000 });
  await clickText(ayu, ".desk-controls .pill", "Main Empat Sejajar");
  await ayu.waitForSelector(".c4-board");
  await clickText(ayu, ".c4-seat button", "Main sebagai merah");
  await ayu.waitForFunction(() => document.querySelector(".c4-seats")?.textContent?.includes("Ayu"));
  const pos = () => ayu.evaluate(() => [0, 2].map((i) => Math.round((window as any).__vo.selfPos.p[i] * 10) / 10));
  const before = await pos();
  await ayu.keyboard.down("KeyW"); // tombol gerak tidak menggerakkan avatar selama jendela terbuka
  await new Promise((r) => setTimeout(r, 500));
  await ayu.keyboard.up("KeyW");
  assert.deepEqual(await pos(), before);
  await ayu.keyboard.press("Escape");
  await ayu.waitForSelector(".c4-board", { hidden: true });

  await ayu.evaluate(() => (window as any).__vo.teleport(-4.5, -42.1)); // depan mesin arcade
  await ayu.waitForFunction(() => (window as any).__vo.useNet.getState().nearGame?.type === "arcade", { timeout: 20_000 });
  await ayu.keyboard.press("KeyF");
  await ayu.waitForSelector(".snake-canvas");
  await ayu.keyboard.press("ArrowUp"); // tombol arah langsung memulai
  await ayu.waitForSelector(".snake-cover", { hidden: true });
  await ayu.keyboard.press("Escape");
  await ayu.waitForSelector(".snake-canvas", { hidden: true });
});

test("town hall di lantai 1: berdiri di panggung", async () => {
  await ayu.evaluate(() => (window as any).__vo.teleport(31.3, 22.3));
  await ayu.waitForSelector(".lift button");
  await clickText(ayu, ".lift button", "Lantai 1");
  await ayu.waitForFunction(() => (window as any).__vo.useNet.getState().floor === "f1");
  await ayu.evaluate(() => (window as any).__vo.teleport(0, -41));
  await ayu.waitForSelector(".pill.stage", { timeout: 20_000 });
});

test("tampilan bahasa Inggris", async () => {
  const p = await open("en");
  assert.ok(await p.$$eval(".tabs .tab", (t) => t.some((x) => x.textContent === "Sign up")));
  await p.close();
});

test("ganti tampilan 2D ↔ 3D: posisi tetap, kembali normal", async () => {
  await ayu.evaluate(() => (window as any).__vo.teleport(0, 15));
  await new Promise((r) => setTimeout(r, 500));
  const before = await ayu.evaluate(() => (window as any).__vo.selfPos.p.map((n: number) => Math.round(n)));
  await clickText(ayu, ".hud-top .pill", "Tampilan");
  await ayu.waitForFunction(() => typeof (window as any).__vo?.teleport === "function", { timeout: 120_000 });
  await new Promise((r) => setTimeout(r, 1000));
  const after = await ayu.evaluate(() => (window as any).__vo.selfPos.p.map((n: number) => Math.round(n)));
  assert.deepEqual([after[0], after[2]], [before[0], before[2]]);
  await clickText(ayu, ".hud-top .pill", "Tampilan");
  await ayu.waitForFunction(() => typeof (window as any).__vo?.teleport === "function", { timeout: 120_000 });
});

test("teleport saat tampilan berikutnya masih dimuat tidak hilang", async () => {
  await clickText(ayu, ".hud-top .pill", "Tampilan");
  await ayu.evaluate(() => import("/src/actions.ts" as string).then((m) => m.teleportTo(-3, 18))); // sebelum renderer baru siap
  await ayu.waitForFunction(() => typeof (window as any).__vo?.teleport === "function", { timeout: 120_000 });
  await new Promise((r) => setTimeout(r, 1000));
  const p = await ayu.evaluate(() => (window as any).__vo.selfPos.p.map((n: number) => Math.round(n)));
  assert.deepEqual([p[0], p[2]], [-3, 18]);
  await clickText(ayu, ".hud-top .pill", "Tampilan");
  await ayu.waitForFunction(() => typeof (window as any).__vo?.teleport === "function", { timeout: 120_000 });
});

test("duduk lalu ganti tampilan: berdiri di titik berdiri kursi, tidak tertinggal di kursi", async () => {
  const seat = await state(ayu, (s) => s.derived.seats.find((x: any) => x.id && Math.abs(x.z - 16) < 12) ?? s.derived.seats[0]);
  await ayu.evaluate((x: number, z: number) => (window as any).__vo.teleport(x, z), seat.x + 0.3, seat.z);
  await ayu.waitForFunction(() => (window as any).__vo.useNet.getState().nearSeat, { timeout: 20_000 });
  await ayu.keyboard.press("KeyC");
  await ayu.waitForFunction(() => (window as any).__vo.useNet.getState().sitting === true);
  await clickText(ayu, ".hud-top .pill", "Tampilan");
  await ayu.waitForFunction(() => typeof (window as any).__vo?.teleport === "function", { timeout: 120_000 });
  await new Promise((r) => setTimeout(r, 1000));
  assert.equal(await state(ayu, (s) => s.sitting), false);
  const p = await ayu.evaluate(() => (window as any).__vo.selfPos.p);
  assert.ok(Math.hypot(p[0] - seat.stand[0], p[2] - seat.stand[1]) < 0.6, `posisi ${p} vs titik berdiri ${seat.stand}`);
  await clickText(ayu, ".hud-top .pill", "Tampilan");
  await ayu.waitForFunction(() => typeof (window as any).__vo?.teleport === "function", { timeout: 120_000 });
});

test("tidak ada error JavaScript di halaman", () => {
  assert.deepEqual(errors, []);
});
