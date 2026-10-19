import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { defaultLayout } from "../../shared/layout";

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
  /** Buang pesan lama bertipe `t` yang belum dibaca. */
  drain(t: string) {
    this.inbox = this.inbox.filter((m) => m.t !== t);
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
let inviteCode = "";
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
  const w = await c.enter([0, 0, 15]);
  assert.equal(w.layout.floors[0].rooms.length >= 1, true);
});

test("mode undangan: daftar tanpa kode ditolak, dengan kode diterima", async () => {
  adminC.send({ t: "admin", action: "registration", mode: "invite" });
  const st = await adminC.wait("admin_state", (m) => m.registration === "invite");
  inviteCode = st.inviteCode;
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
  await budi.enter([-18.8, 0, -21]); // Rapat Divisi 1
  const cici = await new Client().open();
  cici.send({ t: "login", username: "cici", password: "rahasia123" });
  await cici.wait("auth_ok");
  await cici.enter([-21, 0, -22.5]); // Rapat Divisi 1 juga
  adminC.move([-18.8, 0, -16.4]); // di luar ruang rapat (masih di Divisi 1), dekat pintu
  await sleep(200);

  budi.send({ t: "chat", channel: "area", text: "rahasia rapat" });
  const got = await cici.wait("chat", (m) => m.text === "rahasia rapat");
  assert.equal(got.scope, "Rapat Divisi 1");
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
  budi.send({ t: "door", id: "rapat-1", action: "lock" });
  await adminC.wait("world", (m) => m.doors["rapat-1"].locked === true);
  adminC.send({ t: "door", id: "rapat-1", action: "open" });
  await adminC.none("world", (m) => m.doors["rapat-1"].open === true);
  adminC.send({ t: "door", id: "rapat-1", action: "knock" });
  assert.equal((await budi.wait("knock")).name, "ADMIN");

  // Mute semua hanya ke orang di ruangan yang sama
  budi.send({ t: "mute_room" });
  await cici.wait("mute_request");
  await adminC.none("mute_request");

  // Whiteboard: orang luar tidak bisa membaca
  budi.send({ t: "wb_stroke", room: "rapat-1", stroke: { id: "s1", color: "#ff0000", width: 4, pts: [0.1, 0.1, 0.5, 0.5] } });
  await cici.wait("wb_stroke", (m) => m.stroke.id === "s1");
  adminC.send({ t: "wb_open", room: "rapat-1" });
  await adminC.none("wb_state");

  // Semua keluar ruangan → kunci terbuka otomatis
  budi.move([0, 0, 15]);
  cici.move([1, 0, 15]);
  await adminC.wait("world", (m) => m.doors["rapat-1"].locked === false);

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
  const w = await budi.enter([0, 0, 15]);
  const desk = `desk:${w.layout.floors[0].items.find((i: any) => i.type === "desk").id}`;
  budi.send({ t: "desk", action: "claim", id: desk });
  await budi.wait("world", (m) => m.desks[desk]?.ownerId === ids.budi);

  // Member tidak boleh mengubah denah
  const withItems = (items: any[]) => ({ ...w.layout, floors: [{ ...w.layout.floors[0], items }, ...w.layout.floors.slice(1)] });
  budi.send({ t: "layout", layout: withItems([]) });
  await adminC.none("layout");
  // Admin boleh; denah rusak ditolak
  adminC.send({ t: "layout", layout: { rooms: "x" } });
  await adminC.wait("notice");
  adminC.send({ t: "layout", layout: withItems(w.layout.floors[0].items.filter((i: any) => i.type !== "plant")) });
  const lay = await budi.wait("layout");
  assert.ok(!lay.layout.floors[0].items.some((i: any) => i.type === "plant"));
  budi.close();
});

test("koneksi kedua akun yang sama mengeluarkan koneksi lama", async () => {
  const a = await new Client().open();
  a.send({ t: "resume", token: budiToken });
  await a.wait("auth_ok");
  await a.enter([0, 0, 15]);
  const b = await new Client().open();
  b.send({ t: "resume", token: budiToken });
  await b.wait("auth_ok");
  await b.enter([0, 0, 15]);
  assert.match((await a.wait("kicked")).reason, /tab atau perangkat lain/);
  b.close();
});

// ---------- fitur lanjutan ----------

async function member(username: string) {
  const { c, res } = await register(username, { invite: inviteCode });
  assert.equal(res.t, "auth_ok", `daftar ${username}: ${res.reason ?? ""}`);
  return { c, id: res.user.id as string, token: res.token as string };
}

test("panggung town hall terdengar ke seluruh aula; di luar aula & lantai lain tidak", async () => {
  const dodi = await member("dodi");
  const eva = await member("eva");
  const fajar = await member("fajar");
  const gina = await member("gina");
  await dodi.c.enter([0, 0, -41]); // panggung town hall
  await eva.c.enter([15, 0, -30]); // penonton di pojok aula
  await fajar.c.enter([24, 0, 20]); // lounge (di luar aula)
  const hadi = await member("hadi");
  await hadi.c.enter([0, 0, -9.3]); // area meja Divisi 2
  await gina.c.enter([0, 0, 15]);
  gina.c.send({ t: "floor", floor: "f2", p: [0, 0, 0] }); // lantai 2
  await sleep(300);
  dodi.c.send({ t: "chat", channel: "area", text: "pengumuman all-hands" });
  const got = await eva.c.wait("chat", (m) => m.text === "pengumuman all-hands");
  assert.equal(got.scope, "Panggung Town Hall");
  await fajar.c.none("chat", (m) => m.text === "pengumuman all-hands");
  await gina.c.none("chat", (m) => m.text === "pengumuman all-hands");
  await hadi.c.none("chat", (m) => m.text === "pengumuman all-hands");
  for (const x of [dodi, eva, fajar, gina, hadi]) x.c.close();
});

test("status otomatis: toilet/mushola = away, area meja divisi & sendirian di ruangan = tersedia, berdua di ruangan & aula = rapat", async () => {
  const lia = await member("lia");
  await lia.c.enter([0, 0, 15]);
  const statusAt = async (p: [number, number, number], want: string) => {
    lia.c.move(p);
    await adminC.wait("directory", (m) => m.users.some((u: any) => u.id === lia.id && u.status === want));
  };
  await statusAt([-10, 0, 21], "away"); // toilet
  await statusAt([-23, 0, -9.3], "available"); // area meja Divisi 1
  await statusAt([-25.1, 0, -36], "available"); // sendirian di Ruang CEO = bekerja
  const mira = await member("mira");
  await mira.c.enter([-24, 0, -37]); // tamu masuk Ruang CEO
  await adminC.wait("directory", (m) => m.users.some((u: any) => u.id === lia.id && u.status === "meeting"));
  mira.c.close();
  await statusAt([10, 0, 21], "away"); // mushola
  await statusAt([0, 0, -34], "meeting"); // penonton town hall
  lia.c.close();
});

test("ganti password sendiri & reset password oleh admin", async () => {
  const gita = await member("gita");
  await gita.c.enter([0, 0, 15]);
  gita.c.send({ t: "password", old: "salah", new: "barubaru1" });
  assert.match((await gita.c.wait("notice")).text, /lama salah/);
  gita.c.send({ t: "password", old: "rahasia123", new: "barubaru1" });
  await gita.c.wait("password_ok");
  const c2 = await new Client().open();
  c2.send({ t: "login", username: "gita", password: "barubaru1" });
  await c2.wait("auth_ok");
  c2.close();
  adminC.send({ t: "admin", action: "reset_password", userId: gita.id });
  const temp = await adminC.wait("temp_password", (m) => m.userId === gita.id);
  assert.match((await gita.c.wait("kicked")).reason, /direset/);
  const c3 = await new Client().open();
  c3.send({ t: "login", username: "gita", password: temp.password });
  await c3.wait("auth_ok");
  c3.close();
});

test("link tamu: masuk tanpa akun, tidak bisa klaim meja, link bisa dicabut", async () => {
  adminC.drain("admin_state");
  adminC.send({ t: "admin", action: "guest_link", hours: 2, label: "Klien PT Maju" });
  const st = await adminC.wait("admin_state", (m) => m.guestLinks.some((g: any) => g.label === "Klien PT Maju"));
  const link = st.guestLinks.find((g: any) => g.label === "Klien PT Maju").token;
  const g = await new Client().open();
  g.send({ t: "guest", token: link, name: "Pak Tamu" });
  const ok = await g.wait("auth_ok");
  assert.equal(ok.user.role, "guest");
  const w = await g.enter([0, 0, 15]);
  const desk = `desk:${w.layout.floors[0].items.find((i: any) => i.type === "desk").id}`;
  g.send({ t: "desk", action: "claim", id: desk });
  assert.match((await g.wait("notice")).text, /Tamu/);
  adminC.send({ t: "admin", action: "guest_revoke", token: link });
  await adminC.wait("admin_state", (m) => !m.guestLinks.some((x: any) => x.token === link));
  const g2 = await new Client().open();
  g2.send({ t: "guest", token: link, name: "Penyusup" });
  assert.match((await g2.wait("auth_error")).reason, /tidak berlaku/);
  g.close();
  g2.close();
});

test("booking ruangan: bentrok ditolak, booking sah disiarkan", async () => {
  const hana = await member("hana");
  await hana.c.enter([0, 0, 15]);
  const start = Date.now() + 3600_000;
  hana.c.send({ t: "book", room: "rapat-1", title: "Sprint review", start, end: start + 3600_000 });
  const b = await adminC.wait("bookings", (m) => m.list.some((x: any) => x.title === "Sprint review"));
  hana.c.send({ t: "book", room: "rapat-1", title: "Bentrok", start: start + 1800_000, end: start + 5400_000 });
  assert.match((await hana.c.wait("notice")).text, /Bentrok dengan "Sprint review"/);
  hana.c.send({ t: "book", room: "rapat-1", title: "Kilat", start, end: start + 5 * 60_000 });
  assert.match((await hana.c.wait("notice")).text, /15 menit/);
  const id = b.list.find((x: any) => x.title === "Sprint review").id;
  hana.c.send({ t: "unbook", id });
  await adminC.wait("bookings", (m) => !m.list.some((x: any) => x.id === id));
  hana.c.close();
});

test("upload: gambar tampil inline, HTML dipaksa unduh; lampiran ikut di chat", async () => {
  const ika = await member("ika");
  await ika.c.enter([0, 0, 15]);
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a5d20000000049454e44ae426082", "hex");
  ika.c.send({ t: "upload", req: 1, name: "foto.png", mime: "image/png", data: png.toString("base64") });
  const up = await ika.c.wait("upload_ok", (m) => m.req === 1);
  const res = await fetch(`http://localhost:${PORT}/files/${up.file.id}/foto.png`);
  assert.equal(res.headers.get("content-type"), "image/png");
  assert.equal(Buffer.from(await res.arrayBuffer()).equals(png), true);
  ika.c.send({ t: "upload", req: 2, name: "jahat.html", mime: "text/html", data: Buffer.from("<script>alert(1)</script>").toString("base64") });
  const up2 = await ika.c.wait("upload_ok", (m) => m.req === 2);
  const res2 = await fetch(`http://localhost:${PORT}/files/${up2.file.id}/jahat.html`);
  assert.equal(res2.headers.get("content-type"), "application/octet-stream");
  assert.match(res2.headers.get("content-disposition") ?? "", /^attachment/);
  ika.c.send({ t: "upload", req: 3, name: "besar.bin", mime: "application/octet-stream", data: Buffer.alloc(6 * 1024 * 1024).toString("base64") });
  assert.match((await ika.c.wait("upload_error", (m) => m.req === 3)).reason, /5 MB/);
  ika.c.send({ t: "chat", channel: "umum", text: "lihat ini", file: { id: up.file.id } });
  const c = await adminC.wait("chat", (m) => m.text === "lihat ini");
  assert.equal(c.file.name, "foto.png");
  ika.c.close();
});

test("reaksi emoji & pencarian pesan (DM orang lain tidak ikut)", async () => {
  const joni = await member("joni");
  await joni.c.enter([0, 0, 15]);
  joni.c.send({ t: "chat", channel: "umum", text: "deploy jumat sore? 🤔" });
  const m = await adminC.wait("chat", (x) => x.text === "deploy jumat sore? 🤔");
  adminC.send({ t: "react", channel: "umum", id: m.mid, emoji: "👀" });
  const r = await joni.c.wait("reaction", (x) => x.id === m.mid);
  assert.deepEqual(r.reactions["👀"], [ids.admin]);
  adminC.send({ t: "react", channel: "umum", id: m.mid, emoji: "💩" }); // bukan emoji yang diizinkan
  await joni.c.none("reaction", (x) => x.reactions["💩"]);
  joni.c.send({ t: "search", q: "JUMAT" });
  const s = await joni.c.wait("search_result");
  assert.ok(s.results.some((x: any) => x.text.includes("jumat")));
  joni.c.send({ t: "search", q: "psst" }); // DM budi→cici dari tes sebelumnya
  assert.equal((await joni.c.wait("search_result", (x) => x.q === "psst")).results.length, 0);
  joni.c.close();
});

test("website di layar presentasi: hanya dari dalam ruangannya, wajib https, & alamatnya hanya terkirim ke orang di ruangan itu", async () => {
  const kiki = await member("kiki");
  const w = await kiki.c.enter([0, 0, 15]);
  const screen = w.layout.floors[0].items.find((i: any) => i.type === "screen" && i.x === -18.8 && i.z < -23).id; // layar Rapat Divisi 1
  kiki.c.send({ t: "screen_url", item: screen, url: "https://example.com" });
  assert.match((await kiki.c.wait("notice")).text, /Masuk ke ruangan/);
  kiki.c.move([-18.8, 0, -21]);
  await sleep(150);
  kiki.c.send({ t: "screen_url", item: screen, url: "http://tidak-aman.com" });
  assert.match((await kiki.c.wait("notice")).text, /https/);
  kiki.c.send({ t: "screen_url", item: screen, url: "https://example.com" });
  await kiki.c.wait("screens", (m) => m.map[screen] === "https://example.com");
  // Privasi: orang di luar ruangan tidak menerima alamatnya sama sekali (walau dinding kaca)…
  adminC.move([-18.8, 0, -16.4]); // di Divisi 1, persis di luar ruang rapat
  await adminC.none("screens", (m) => m.map[screen] !== undefined);
  assert.ok(!adminC.inbox.some((m: any) => m.t === "screens" && m.map[screen] !== undefined), "alamat bocor ke orang di luar ruangan");
  // …baru menerima begitu masuk ruangan, dan kehilangan lagi saat keluar.
  adminC.move([-18.8, 0, -19]);
  await adminC.wait("screens", (m) => m.map[screen] === "https://example.com");
  adminC.move([0, 0, 15]);
  await adminC.wait("screens", (m) => m.map[screen] === undefined);
  kiki.c.close();
});

test("login gagal 5× untuk satu username diblokir sementara, password benar pun ditolak", async () => {
  const { c: reg } = await register("kunci");
  reg.close();
  const c = await new Client().open();
  for (let i = 0; i < 5; i++) {
    c.send({ t: "login", username: "kunci", password: "salah" });
    assert.equal((await c.wait("auth_error")).reason, "Username atau password salah.");
  }
  c.close();
  const c2 = await new Client().open(); // koneksi baru tidak mengosongkan hitungan
  c2.send({ t: "login", username: "kunci", password: "rahasia123" });
  assert.match((await c2.wait("auth_error")).reason, /^Terlalu banyak percobaan\. Coba lagi dalam \d+ menit\.$/);
  c2.close();
});

// ---------- game Lantai 2 ----------

const f2Items = defaultLayout().floors[1].items;
const arcade = f2Items.find((i) => i.type === "arcade")!;
const table = f2Items.find((i) => i.type === "gameTable")!;

async function onFloor2(username: string, p: [number, number, number]) {
  const m = await member(username);
  await m.c.enter([0, 0, 15]);
  m.c.send({ t: "floor", floor: "f2", p });
  await sleep(150);
  return m;
}

test("arcade Snake: skor hanya dari dekat mesin, satu entri terbaik per orang, urut tertinggi", async () => {
  const hana = await onFloor2("g.hana", [arcade.x, 0, arcade.z + 1.2]);
  const jauh = await onFloor2("g.jauh", [10, 0, 10]);
  jauh.c.send({ t: "arcade_score", game: "snake", machine: arcade.id, score: 99 });
  await hana.c.none("arcade_scores");
  hana.c.send({ t: "arcade_score", game: "snake", machine: arcade.id, score: 12 });
  assert.deepEqual((await hana.c.wait("arcade_scores")).top.map((e: any) => [e.name, e.score]), [["G.HANA", 12]]);
  hana.c.send({ t: "arcade_score", game: "snake", machine: arcade.id, score: 5 }); // lebih rendah: diabaikan
  await hana.c.none("arcade_scores");
  hana.c.send({ t: "arcade_score", game: "snake", machine: arcade.id, score: 1.5 }); // bukan bilangan bulat
  await hana.c.none("arcade_scores");
  hana.c.send({ t: "arcade_scores", game: "snake" });
  assert.equal((await hana.c.wait("arcade_scores")).top[0].score, 12);
  for (const x of [hana, jauh]) x.c.close();
});

test("Empat Sejajar: dua pemain bergiliran, server menentukan pemenang; penonton jauh tidak bisa ikut", async () => {
  const ika = await onFloor2("g.ika", [table.x, 0, table.z - 1.1]);
  const joni = await onFloor2("g.joni", [table.x, 0, table.z + 1.1]);
  const jauh = await onFloor2("g.kiki", [10, 0, 10]);
  jauh.c.send({ t: "c4_join", table: table.id, seat: 0 });
  await jauh.c.none("c4_state");
  ika.c.send({ t: "c4_join", table: table.id, seat: 0 });
  await joni.c.wait("c4_state", (m) => m.seats[0]?.name === "G.IKA");
  joni.c.send({ t: "c4_join", table: table.id, seat: 0 }); // kursi merah sudah terisi
  assert.equal((await joni.c.wait("notice")).text, "Kursi itu sudah terisi.");
  joni.c.send({ t: "c4_join", table: table.id, seat: 1 });
  for (const x of [ika, joni, jauh]) await x.c.wait("c4_state", (m) => m.seats[1]?.name === "G.JONI");
  jauh.c.drain("c4_state");
  joni.c.send({ t: "c4_drop", table: table.id, col: 3 }); // bukan gilirannya
  await joni.c.none("c4_state");
  // Merah menumpuk di kolom 0, kuning di kolom 1 → merah menang di langkah ke-7.
  const moves: [typeof ika, number][] = [[ika, 0], [joni, 1], [ika, 0], [joni, 1], [ika, 0], [joni, 1], [ika, 0]];
  let last: any;
  for (const [who, col] of moves) {
    who.c.send({ t: "c4_drop", table: table.id, col });
    last = await jauh.c.wait("c4_state"); // penonton di lantai yang sama ikut melihat
  }
  assert.equal(last.result, 1);
  assert.equal(last.line.length, 4);
  joni.c.send({ t: "c4_drop", table: table.id, col: 2 }); // permainan sudah selesai
  await joni.c.none("c4_state", (m) => m.board.filter((v: number) => v).length > 7);
  // Pemain keluar → kursinya kosong & papan diulang.
  ika.c.close();
  const after = await joni.c.wait("c4_state", (m) => m.seats[0] === null);
  assert.equal(after.board.filter((v: number) => v).length, 0);
  for (const x of [joni, jauh]) x.c.close();
});
