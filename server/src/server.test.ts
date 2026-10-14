import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

// Integration test: server sungguhan (port & database sementara), beberapa klien WebSocket.

const PORT = 25670 + Math.floor(Math.random() * 1000);
const dir = mkdtempSync(join(tmpdir(), "vo-test-"));
let server: ChildProcess;

const AVATAR = { body: "male", top: "shirt" };

class Client {
  ws!: WebSocket;
  inbox: any[] = [];
  waiters: { pred: (m: any) => boolean; resolve: (m: any) => void }[] = [];

  async open() {
    this.ws = new WebSocket(`ws://localhost:${PORT}`);
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      const w = this.waiters.find((x) => x.pred(m));
      if (w) {
        this.waiters.splice(this.waiters.indexOf(w), 1);
        w.resolve(m);
      } else this.inbox.push(m);
    });
    await new Promise((r) => this.ws.once("open", r));
    return this;
  }
  send(m: unknown) {
    this.ws.send(JSON.stringify(m));
  }
  wait(t: string, extra: (m: any) => boolean = () => true, ms = 3000): Promise<any> {
    const pred = (m: any) => m.t === t && extra(m);
    const i = this.inbox.findIndex(pred);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const w = { pred, resolve };
      this.waiters.push(w);
      setTimeout(() => {
        const idx = this.waiters.indexOf(w);
        if (idx >= 0) {
          this.waiters.splice(idx, 1);
          reject(new Error(`timeout menunggu "${t}"`));
        }
      }, ms);
    });
  }
  /** Pastikan TIDAK menerima pesan tertentu dalam `ms`. */
  async none(t: string, extra: (m: any) => boolean = () => true, ms = 400) {
    const from = this.inbox.length; // hanya pesan yang datang setelah titik ini
    await new Promise((r) => setTimeout(r, ms));
    assert.ok(!this.inbox.slice(from).some((m) => m.t === t && extra(m)), `tidak boleh menerima "${t}"`);
  }
  async enter(p: [number, number, number]) {
    this.send({ t: "enter", avatar: AVATAR, p });
    return this.wait("welcome");
  }
  move(p: [number, number, number]) {
    this.send({ t: "move", p, r: 0, a: 0 });
  }
  close() {
    this.ws.close();
  }
}

async function register(username: string, extra: Record<string, unknown> = {}) {
  const c = await new Client().open();
  c.send({ t: "register", username, password: "rahasia123", name: username.toUpperCase(), ...extra });
  return { c, res: await c.wait("auth_ok").catch(() => c.wait("auth_error")) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  server = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)), // folder server/, dari mana pun tes dijalankan
    env: { ...process.env, PORT: String(PORT), DATA_FILE: join(dir, "db.json") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    server.stdout!.on("data", (d) => String(d).includes("jalan di") && resolve());
    server.stderr!.on("data", (d) => process.stderr.write(d));
    setTimeout(() => reject(new Error("server tidak start")), 15000);
  });
});

after(async () => {
  const exited = new Promise((r) => server.once("exit", r));
  server.kill();
  await exited;
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

const ids: Record<string, string> = {};
let adminC: Client;
let budiToken = "";

test("pendaftar pertama jadi admin; validasi username & password", async () => {
  const bad = await register("A!");
  assert.equal(bad.res.t, "auth_error");
  const { c, res } = await register("admin");
  assert.equal(res.t, "auth_ok");
  assert.equal(res.user.role, "admin");
  ids.admin = res.user.id;
  adminC = c;
  const w = await c.enter([0, 0, 9]);
  assert.equal(w.layout.rooms.length >= 1, true);
});

test("mode undangan: daftar tanpa kode ditolak, dengan kode diterima", async () => {
  adminC.send({ t: "admin", action: "registration", mode: "invite" });
  const st = await adminC.wait("admin_state", (m) => m.registration === "invite");
  const fail = await register("budi");
  assert.equal(fail.res.t, "auth_error");
  fail.c.close();
  const ok = await register("budi", { invite: st.inviteCode });
  assert.equal(ok.res.t, "auth_ok");
  assert.equal(ok.res.user.role, "member");
  ids.budi = ok.res.user.id;
  budiToken = ok.res.token;
  ok.c.close();
  const cici = await register("cici", { invite: st.inviteCode });
  ids.cici = cici.res.user.id;
  cici.c.close();
});

test("login salah ditolak; resume token berhasil; user baru diminta buat avatar", async () => {
  const c = await new Client().open();
  c.send({ t: "login", username: "budi", password: "salah" });
  assert.equal((await c.wait("auth_error")).t, "auth_error");
  c.send({ t: "resume", token: budiToken });
  await c.wait("auth_ok");
  c.send({ t: "enter" });
  await c.wait("need_avatar");
  c.close();
});

test("chat area hanya sampai ke orang di area yang sama; chat umum ke semua", async () => {
  const budi = await new Client().open();
  budi.send({ t: "resume", token: budiToken });
  await budi.wait("auth_ok");
  await budi.enter([10, 0, -6]); // Ruang Meeting
  const cici = await new Client().open();
  cici.send({ t: "login", username: "cici", password: "rahasia123" });
  await cici.wait("auth_ok");
  await cici.enter([12, 0, -9]); // Ruang Meeting juga
  adminC.move([9.9, 0, 0]); // di luar, dekat pintu
  await sleep(200);

  budi.send({ t: "chat", channel: "area", text: "rahasia rapat" });
  const got = await cici.wait("chat", (m) => m.text === "rahasia rapat");
  assert.equal(got.scope, "Ruang Meeting");
  await adminC.none("chat", (m) => m.text === "rahasia rapat");

  budi.send({ t: "chat", channel: "umum", text: "halo semua" });
  await adminC.wait("chat", (m) => m.channel === "umum" && m.text === "halo semua");

  // DM tersimpan & bisa diambil ulang
  budi.send({ t: "dm", to: ids.cici, text: "psst" });
  await cici.wait("dm", (m) => m.msg.text === "psst");
  cici.send({ t: "dm_history", with: ids.budi });
  const hist = await cici.wait("dm_history");
  assert.equal(hist.messages.at(-1).text, "psst");

  // Pintu: dikunci dari dalam; orang luar tidak bisa membuka, hanya mengetuk
  budi.send({ t: "door", id: "meeting", action: "lock" });
  await adminC.wait("world", (m) => m.doors.meeting.locked === true);
  adminC.send({ t: "door", id: "meeting", action: "open" });
  await adminC.none("world", (m) => m.doors.meeting.open === true);
  adminC.send({ t: "door", id: "meeting", action: "knock" });
  assert.equal((await budi.wait("knock")).name, "ADMIN");

  // Mute semua hanya ke orang di ruangan yang sama
  budi.send({ t: "mute_room" });
  await cici.wait("mute_request");
  await adminC.none("mute_request");

  // Whiteboard: orang luar tidak bisa membaca
  budi.send({ t: "wb_stroke", room: "meeting", stroke: { id: "s1", color: "#ff0000", width: 4, pts: [0.1, 0.1, 0.5, 0.5] } });
  await cici.wait("wb_stroke", (m) => m.stroke.id === "s1");
  adminC.send({ t: "wb_open", room: "meeting" });
  await adminC.none("wb_state");

  // Semua keluar ruangan → kunci terbuka otomatis
  budi.move([0, 0, 9]);
  cici.move([1, 0, 9]);
  await adminC.wait("world", (m) => m.doors.meeting.locked === false);

  // Status: direktori menandai siapa online
  budi.send({ t: "status", manual: "busy" });
  const dir = await adminC.wait("directory", (m) => m.users.some((u: any) => u.id === ids.budi && u.status === "busy"));
  assert.ok(dir.users.find((u: any) => u.id === ids.cici).online);
  budi.close();
  cici.close();
});

test("meja: klaim tersimpan; satu orang satu meja; hanya admin bisa ubah denah", async () => {
  const budi = await new Client().open();
  budi.send({ t: "resume", token: budiToken });
  await budi.wait("auth_ok");
  const w = await budi.enter([0, 0, 9]);
  const desk = `desk:${w.layout.items.find((i: any) => i.type === "desk").id}`;
  budi.send({ t: "desk", action: "claim", id: desk });
  await budi.wait("world", (m) => m.desks[desk]?.ownerId === ids.budi);

  // Member tidak boleh mengubah denah
  budi.send({ t: "layout", layout: { ...w.layout, items: [] } });
  await adminC.none("layout");
  // Admin boleh; denah rusak ditolak
  adminC.send({ t: "layout", layout: { rooms: "x" } });
  await adminC.wait("notice");
  adminC.send({ t: "layout", layout: { ...w.layout, items: w.layout.items.filter((i: any) => i.type !== "plant") } });
  const lay = await budi.wait("layout");
  assert.ok(!lay.layout.items.some((i: any) => i.type === "plant"));
  budi.close();
});

test("koneksi kedua akun yang sama mengeluarkan koneksi lama", async () => {
  const a = await new Client().open();
  a.send({ t: "resume", token: budiToken });
  await a.wait("auth_ok");
  await a.enter([0, 0, 9]);
  const b = await new Client().open();
  b.send({ t: "resume", token: budiToken });
  await b.wait("auth_ok");
  await b.enter([0, 0, 9]);
  assert.match((await a.wait("kicked")).reason, /tab atau perangkat lain/);
  b.close();
});
