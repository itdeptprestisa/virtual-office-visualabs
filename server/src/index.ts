import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { AccessToken } from "livekit-server-sdk";
import { sanitizeAvatar } from "./avatar.js";
import { UPLOAD_DIR, backup, db, dmKey, flush, pushCapped, save, sweepUploads, type ChatMsg, type FileRef, type Stroke, type User } from "./store.js";
import { SESSION_DAYS, USERNAME_RE, hashPassword, newId, newToken, verifyPassword } from "./auth.js";
import { busyAt, fetchCalendar, type CalEvent } from "./calendar.js";
import { Limiter, tooMany } from "./ratelimit.js";
import { staticHandler } from "./static.js";
import {
  PROXIMITY,
  SPAWN,
  defaultLayout,
  addDecorations,
  isDecoration1,
  isDecoration2,
  moveDecorations,
  DECORATION_MOVES,
  derive,
  linkIn,
  roomOf,
  sanitizeLayout,
  zoneIn,
  type Derived,
  type ItemType,
  type Layout,
  type Zone,
} from "../../shared/layout.js";
import { C4_COLS, c4Drop, c4Empty, c4Line, c4Result, type C4Piece, type C4Result } from "../../shared/connect4.js";

try {
  process.loadEnvFile();
} catch {
  /* .env opsional */
}

// Protokol (JSON lewat WebSocket). Alur: login/register/resume/guest → auth_ok → enter → welcome.
//   client → server: login | register | resume | guest {token,name} | enter {avatar?, p?} | move | floor {floor,p}
//                    | avatar | settings {name?, ical?} | password {old,new} | logout
//                    | chat {channel: area|umum, text, file?} | dm {to, text, file?} | dm_history {with}
//                    | react {channel, id, emoji, with?} | search {q} | upload {req, name, mime, data}
//                    | status {manual, idle} | summon {to} | hand {up} | mute_room | desk {action, id?} | door {id, action}
//                    | book {room, title, start, end} | unbook {id} | screen_url {item, url}
//                    | wb_open {room} | wb_stroke {room, stroke} | wb_clear {room} | layout {layout|reset} | admin {action, ...}
//   server → client: auth_ok | auth_error | need_avatar | kicked | welcome | media | join | leave | player | move_to | state
//                    | world | layout | directory | chat | dm | dm_history | reaction | search_result | upload_ok | upload_error
//                    | summon | knock | mute_request | bookings | screens | wb_state | wb_stroke | wb_clear
//                    | admin_state | temp_password | settings_ok | password_ok | notice | full
// HTTP: GET /files/<id>/<nama> (lampiran chat), GET /health.

type Vec3 = [number, number, number];
type Manual = "available" | "busy" | "away";

interface Player {
  id: string; // = id user
  user: User;
  ws: WebSocket;
  token: string;
  floor: string;
  p: Vec3;
  r: number;
  a: number;
  dirty: boolean;
  alive: boolean;
  manual: Manual;
  idle: boolean;
  hand: boolean;
  zone: Zone | null;
}

const PORT = Number(process.env.PORT ?? 2567);
const TICK_HZ = 15;
const MAX_PLAYERS = 60;
const WORLD_LIMIT = 50;
const ANIM_COUNT = 7;
const MAX_UPLOAD = 5 * 1024 * 1024; // 5 MB
const INLINE_MIME = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const REACTIONS = new Set(["👍", "❤️", "😂", "🎉", "👀", "🙏"]);

// Default = `livekit-server --dev` lokal. Untuk LiveKit Cloud isi .env (lihat .env.example).
// Tanpa LIVEKIT_URL, client memakai host halaman (port 7880) supaya tetap jalan dari perangkat lain di LAN.
const LIVEKIT_URL = process.env.LIVEKIT_URL || null;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "secret";
const LIVEKIT_ROOM = process.env.LIVEKIT_ROOM ?? "office";

// Produksi (NODE_ENV=production, mis. di Docker) wajib pakai LiveKit & kunci sendiri — kunci dev itu publik.
if (process.env.NODE_ENV === "production") {
  const missing = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Mode produksi butuh ${missing.join(", ")} (lihat .env.example).`);
    process.exit(1);
  }
  if (LIVEKIT_API_SECRET.length < 32) {
    console.error("LIVEKIT_API_SECRET minimal 32 karakter.");
    process.exit(1);
  }
}

// Di belakang reverse proxy (Traefik Dokploy) IP asli ada di X-Forwarded-For; tanpa TRUST_PROXY header itu diabaikan.
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const clientIp = (req: IncomingMessage) =>
  (TRUST_PROXY && String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim()) || req.socket.remoteAddress || "?";

// Batas percobaan. Penahan utama tebak-tebakan password = gagal per username; batas per IP dibuat longgar
// karena satu kantor bisa keluar lewat satu IP (Wi-Fi/NAT yang sama).
const loginFailUser = new Limiter(5, 15 * 60_000);
const loginFailIp = new Limiter(50, 15 * 60_000);
const registerIp = new Limiter(30, 60 * 60_000);
const guestIp = new Limiter(60, 60 * 60_000);
setInterval(() => [loginFailUser, loginFailIp, registerIp, guestIp].forEach((l) => l.prune()), 10 * 60_000).unref();

async function mediaToken(id: string, name: string) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: id, name, ttl: "8h" });
  at.addGrant({ roomJoin: true, room: LIVEKIT_ROOM, canPublish: true, canSubscribe: true });
  return at.toJwt();
}

// ---------- migrasi data lama ----------

for (const m of db.umum) m.id ??= newId();
for (const list of Object.values(db.dms)) for (const m of list) m.id ??= newId();
mkdirSync(UPLOAD_DIR, { recursive: true });
try {
  backup();
} catch (err) {
  console.warn("Backup gagal:", err);
}

// Lampiran yang pesannya sudah tergeser batas riwayat dihapus dari disk (saat start & tiap jam).
function cleanUploads() {
  try {
    const n = sweepUploads();
    if (n) console.log(`Lampiran tak terpakai dihapus: ${n} file`);
  } catch (err) {
    console.warn("Pembersihan lampiran gagal:", err);
  }
}
cleanUploads();
setInterval(cleanUploads, 3600_000).unref();

// ---------- denah & state dunia ----------

let layout: Layout = (db.layout && sanitizeLayout(db.layout)) || defaultLayout();
// Denah tersimpan dari sebelum ada dekorasi dilengkapi sekali per gelombang — dekorasi yang kemudian dihapus admin
// tidak dimunculkan lagi.
for (const [id, pick] of [
  ["dekorasi-2026-10", isDecoration1],
  ["dekorasi-2026-10b", isDecoration2],
] as const) {
  if (db.migrations.includes(id)) continue;
  if (db.layout) {
    layout = sanitizeLayout(addDecorations(layout, defaultLayout(), pick)) ?? layout;
    db.layout = layout;
  }
  db.migrations.push(id);
  save();
}
// Printer & tanaman besar yang dulu ditaruh di persimpangan lorong dipindah (kecuali sudah dipindah admin).
if (!db.migrations.includes("persimpangan-2026-10")) {
  if (db.layout) {
    layout = sanitizeLayout(moveDecorations(layout, DECORATION_MOVES)) ?? layout;
    db.layout = layout;
  }
  db.migrations.push("persimpangan-2026-10");
  save();
}
let derived: Record<string, Derived> = derive(layout);
const firstFloor = () => layout.floors[0].id;
const floorName = (id: string) => layout.floors.find((f) => f.id === id)?.name ?? id;
const zoneAt = (floor: string, p: Vec3) => (derived[floor] ? zoneIn(derived[floor], p[0], p[2]) : null);
const allZones = () => Object.values(derived).flatMap((d) => d.zones);
const allRooms = () => layout.floors.flatMap((f) => f.rooms);

interface DoorState {
  open: boolean;
  locked: boolean;
}
const doors = new Map<string, DoorState>();
const lockedDesks = new Set<string>(); // id zona meja yang sedang mode fokus (berlaku selama pemilik online)

function syncDoors() {
  const ids = Object.values(derived).flatMap((d) => d.doors.map((x) => x.id));
  for (const id of ids) if (!doors.has(id)) doors.set(id, { open: true, locked: false });
  for (const id of doors.keys()) if (!ids.includes(id)) doors.delete(id);
}
syncDoors();

const players = new Map<string, Player>();
const userById = (id: string) => db.users.find((u) => u.id === id);
const deskOf = (userId: string) => Object.entries(db.deskOwners).find(([, uid]) => uid === userId)?.[0];

function worldView() {
  const desks: Record<string, { ownerId: string; ownerName: string; locked: boolean; online: boolean }> = {};
  const zones = allZones();
  for (const [deskId, ownerId] of Object.entries(db.deskOwners)) {
    const owner = userById(ownerId);
    if (!owner || !zones.some((z) => z.id === deskId)) continue;
    desks[deskId] = { ownerId, ownerName: owner.name, locked: lockedDesks.has(deskId), online: players.has(ownerId) };
  }
  return { t: "world", desks, doors: Object.fromEntries(doors) };
}

const insideRoom = (roomId: unknown, pl: Player) => pl.zone?.id === `room:${roomId}`;

// ---------- presence & direktori ----------

const calendarCache = new Map<string, CalEvent[]>();
const calendarBusy = new Map<string, CalEvent | null>();

/**
 * Dianggap rapat: di panggung, di aula yang punya panggung, atau di ruangan bersuara penuh bersama orang lain
 * (sendirian di ruang manager/CEO = sedang bekerja, bukan rapat).
 */
function inMeeting(pl: Player, zone: Zone) {
  if (zone.stage) return true;
  if (zone.kind !== "room") return false;
  if (derived[pl.floor]?.zones.some((z) => z.stage && z.parent === zone.id)) return true;
  if (zone.audio !== "full") return false;
  for (const o of players.values()) if (o !== pl && o.floor === pl.floor && o.zone?.id === zone.id) return true;
  return false;
}

function statusOf(pl: Player): "available" | "busy" | "meeting" | "away" | "focus" {
  if (pl.manual === "busy") return "busy";
  if (pl.manual === "away") return "away";
  const myDesk = deskOf(pl.id);
  if (myDesk && lockedDesks.has(myDesk)) return "focus";
  if (calendarBusy.get(pl.id)) return "meeting";
  if (pl.zone?.audio === "mute") return "away"; // toilet, mushola
  if (pl.zone && inMeeting(pl, pl.zone)) return "meeting";
  if (pl.idle) return "away";
  return "available";
}

function directory() {
  return db.users
    .filter((u) => !u.disabled)
    .map((u) => {
      const pl = players.get(u.id);
      return {
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        online: !!pl,
        status: pl ? statusOf(pl) : "offline",
        calendar: pl ? !!calendarBusy.get(u.id) : false,
        zone: pl?.zone?.name ?? null,
        floor: pl ? pl.floor : null,
        floorName: pl ? floorName(pl.floor) : null,
        hand: pl?.hand ?? false,
      };
    });
}

let directoryDirty = false;
const markDirectory = () => (directoryDirty = true);

// ---------- kirim ----------

function send(ws: WebSocket, msg: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function sendTo(filter: (pl: Player) => boolean, msg: unknown) {
  const data = JSON.stringify(msg);
  for (const pl of players.values()) if (filter(pl) && pl.ws.readyState === WebSocket.OPEN) pl.ws.send(data);
}

const broadcast = (msg: unknown, exceptId?: string) => sendTo((pl) => pl.id !== exceptId, msg);

const publicView = (pl: Player) => ({ id: pl.id, name: pl.user.name, avatar: pl.user.avatar, floor: pl.floor, p: pl.p, r: pl.r, a: pl.a });

const selfView = (u: User) => ({ id: u.id, username: u.username, name: u.name, role: u.role, avatar: u.avatar, ical: u.ical, guestExp: u.guestExp ?? null, tour: u.tourPending === true });

function adminState() {
  const now = Date.now();
  return {
    t: "admin_state",
    users: db.users.map((u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, disabled: u.disabled, online: players.has(u.id) })),
    registration: db.settings.registration,
    inviteCode: db.settings.inviteCode,
    guestLinks: Object.entries(db.guestLinks)
      .filter(([, g]) => g.exp > now)
      .map(([token, g]) => ({ token, label: g.label, exp: g.exp })),
  };
}
const pushAdminState = () => sendTo((pl) => pl.user.role === "admin", adminState());

const upcomingBookings = () => db.bookings.filter((b) => b.end > Date.now() - 3600_000).sort((a, b) => a.start - b.start);
const bookingsView = () => ({ t: "bookings", list: upcomingBookings() });

// ---------- util ----------

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const randomSpawn = (): Vec3 => [SPAWN.x[0] + Math.random() * (SPAWN.x[1] - SPAWN.x[0]), 0, SPAWN.z[0] + Math.random() * (SPAWN.z[1] - SPAWN.z[0])];

function validVec3(v: unknown): Vec3 | null {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) return null;
  return [clamp(v[0], WORLD_LIMIT), clamp(v[1], WORLD_LIMIT), clamp(v[2], WORLD_LIMIT)];
}

function createSession(userId: string, exp = Date.now() + SESSION_DAYS * 86_400_000) {
  const token = newToken();
  db.sessions[token] = { userId, exp };
  save();
  return token;
}

function sanitizeStroke(s: any): Stroke | null {
  if (!s || typeof s.id !== "string" || s.id.length > 40 || !Array.isArray(s.pts) || s.pts.length > 4000) return null;
  if (!s.pts.every((n: unknown) => isNum(n) && n >= 0 && n <= 1)) return null;
  const color = /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#222222";
  const width = isNum(s.width) ? Math.min(40, Math.max(1, s.width)) : 4;
  return { id: s.id, color, width, pts: s.pts };
}

/** Lampiran chat: hanya file yang benar-benar pernah diunggah. */
function fileRef(v: any): FileRef | undefined {
  const f = v && typeof v.id === "string" ? db.files[v.id] : undefined;
  return f ? { id: v.id, name: f.name, mime: f.mime, size: f.size } : undefined;
}

/** Siapa yang menerima chat "area" dari pengirim: sama dengan siapa yang bisa mendengar suaranya (linkIn). */
function areaAudience(me: Player) {
  return (pl: Player) => {
    if (pl.floor !== me.floor) return false;
    if (pl === me) return true;
    const d = derived[me.floor];
    return !!d && linkIn(d, pl.p[0], pl.p[2], me.p[0], me.p[2]).distance <= PROXIMITY.hear + PROXIMITY.hysteresis;
  };
}

function setZone(pl: Player) {
  const z = zoneAt(pl.floor, pl.p);
  if (z?.id !== pl.zone?.id) {
    pl.zone = z;
    markDirectory();
    sendScreens(pl);
  }
}

// ---------- website di layar presentasi: hanya untuk orang di ruangan layar itu ----------

/** Bisa melihat layar? Sama dengan aturan suara: satu zona dengan layar; layar di panggung = seisi ruangan panggung itu. */
function canSeeScreen(pl: Player, floor: string, zone: Zone) {
  if (pl.floor !== floor) return false;
  if (pl.zone?.id === zone.id) return true;
  const d = derived[floor];
  return !!zone.stage && !!d && roomOf(d, zone)?.id === roomOf(d, pl.zone)?.id;
}

/** Alamat website hanya dikirim ke yang bisa melihat layarnya — orang di luar ruangan tidak menerima apa pun. */
function screensFor(pl: Player): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of layout.floors) {
    const d = derived[f.id];
    if (!d) continue;
    for (const it of f.items) {
      const url = db.screens[it.id];
      if (!url || it.type !== "screen") continue;
      const zone = zoneIn(d, it.x, it.z, true);
      if (zone && canSeeScreen(pl, f.id, zone)) out[it.id] = url;
    }
  }
  return out;
}

const lastScreens = new WeakMap<Player, string>();
function sendScreens(pl: Player) {
  const map = screensFor(pl);
  const key = JSON.stringify(map);
  if (lastScreens.get(pl) === key) return;
  lastScreens.set(pl, key);
  send(pl.ws, { t: "screens", map });
}

// ---------- game arcade (Lantai 2) ----------

const ARCADE_GAMES = new Set(["snake"]);
const SCORE_MAX = 10_000;
const SCORE_TOP = 10;
const GAME_REACH = 3.5; // m — harus berdiri dekat mesin/meja untuk main

/** Item game dengan id & jenis itu di lantai pemain, dalam jangkauan. */
function gameItemNear(pl: Player, id: unknown, type: ItemType) {
  const it = layout.floors.find((f) => f.id === pl.floor)?.items.find((i) => i.id === id && i.type === type);
  return it && Math.hypot(it.x - pl.p[0], it.z - pl.p[2]) <= GAME_REACH ? it : undefined;
}

// Empat Sejajar: state per meja hanya di memori (permainan singkat, tidak perlu disimpan).
interface C4Game {
  floor: string;
  board: number[];
  seats: [Player | null, Player | null]; // [merah, kuning]
  turn: C4Piece;
  result: C4Result;
  last: number | null; // sel keping terakhir
}
const c4Games = new Map<string, C4Game>();

const c4View = (table: string, g?: C4Game) => ({
  t: "c4_state",
  table,
  board: g?.board ?? c4Empty(),
  seats: (g?.seats ?? [null, null]).map((p) => (p ? { id: p.id, name: p.user.name } : null)),
  turn: g?.turn ?? 1,
  result: g?.result ?? 0,
  line: g ? c4Line(g.board) : null,
  last: g?.last ?? null,
});
const c4Push = (table: string, g: C4Game) => sendTo((pl) => pl.floor === g.floor, c4View(table, g));

function c4Reset(g: C4Game) {
  g.board = c4Empty();
  g.turn = 1;
  g.result = 0;
  g.last = null;
}

/** Lepas pemain dari meja mana pun (keluar, pindah lantai, pindah meja); permainan yang ditinggal diulang. */
function c4LeaveAll(pl: Player) {
  for (const [table, g] of c4Games) {
    const i = g.seats.indexOf(pl);
    if (i < 0) continue;
    g.seats[i] = null;
    c4Reset(g);
    c4Push(table, g);
  }
}

// ---------- HTTP: lampiran ----------

function serveFile(req: IncomingMessage, res: ServerResponse) {
  const m = req.url?.match(/^\/files\/([a-f0-9]{12,32})(?:\/[^?]*)?/);
  const meta = m ? db.files[m[1]] : undefined;
  const path = m ? resolve(UPLOAD_DIR, m[1]) : "";
  if (!meta || !existsSync(path)) {
    res.writeHead(404).end("Not found");
    return;
  }
  const inline = INLINE_MIME.has(meta.mime);
  res.writeHead(200, {
    "Content-Type": inline ? meta.mime : "application/octet-stream",
    "Content-Length": meta.size,
    // File selain gambar selalu diunduh, tidak pernah dirender di origin ini (mencegah HTML/SVG berbahaya).
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "private, max-age=31536000, immutable",
  });
  createReadStream(path).pipe(res);
}

// Hasil build client; default ../client/dist relatif ke folder server. Tidak ada (mode dev) → hanya API.
const serveStatic = staticHandler(process.env.STATIC_DIR ?? "../client/dist");

const http = createServer((req, res) => {
  if (req.url?.startsWith("/files/")) return serveFile(req, res);
  if (req.url === "/health") return void res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
  if (serveStatic) return serveStatic(req, res);
  res.writeHead(404).end();
});

// ---------- koneksi ----------

// Batas pesan > batas upload (base64 ±1,37×) supaya file kebesaran ditolak dengan pesan, bukan memutus koneksi.
const wss = new WebSocketServer({ server: http, maxPayload: 12 * 1024 * 1024 });

wss.on("connection", (ws, req) => {
  const ip = clientIp(req);
  let authed: User | null = null;
  let token = "";
  let me: Player | null = null;
  let attempts = 0;

  const authOk = (u: User, tok: string) => {
    authed = u;
    token = tok;
    send(ws, { t: "auth_ok", token: tok, user: selfView(u) });
  };
  const authError = (reason: string) => send(ws, { t: "auth_error", reason });

  ws.on("message", (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // ----- autentikasi -----
    if (!authed) {
      if (++attempts > 20) return ws.close();
      if (msg?.t === "resume") {
        const s = db.sessions[msg.token];
        const u = s && s.exp > Date.now() ? userById(s.userId) : undefined;
        if (!u || u.disabled) return authError("Sesi berakhir, silakan masuk lagi.");
        return authOk(u, msg.token);
      }
      if (msg?.t === "login") {
        const username = text(msg.username, 40).toLowerCase();
        const wait = Math.max(loginFailUser.blocked(username), loginFailIp.blocked(ip));
        if (wait) return authError(tooMany(wait));
        const u = db.users.find((x) => x.username === username);
        if (!u || u.role === "guest" || !verifyPassword(String(msg.password ?? ""), u.salt, u.passHash)) {
          loginFailUser.hit(username);
          loginFailIp.hit(ip);
          return authError("Username atau password salah.");
        }
        if (u.disabled) return authError("Akun ini dinonaktifkan admin.");
        loginFailUser.reset(username);
        return authOk(u, createSession(u.id));
      }
      if (msg?.t === "guest") {
        const wait = guestIp.blocked(ip);
        if (wait) return authError(tooMany(wait));
        guestIp.hit(ip);
        const link = db.guestLinks[String(msg.token)];
        const name = text(msg.name, 24);
        if (!link || link.exp < Date.now()) return authError("Link tamu sudah tidak berlaku.");
        if (!name) return authError("Nama wajib diisi.");
        const u: User = {
          id: newId(),
          username: `tamu.${newId().slice(0, 5)}`,
          name,
          passHash: "",
          salt: "",
          role: "guest",
          disabled: false,
          avatar: null,
          ical: null,
          createdAt: Date.now(),
          lastPos: null,
          guestExp: link.exp,
          tourPending: true,
        };
        db.users.push(u);
        save();
        pushAdminState();
        return authOk(u, createSession(u.id, link.exp));
      }
      if (msg?.t === "register") {
        const wait = registerIp.blocked(ip);
        if (wait) return authError(tooMany(wait));
        registerIp.hit(ip);
        const username = text(msg.username, 40).toLowerCase();
        const password = String(msg.password ?? "");
        const name = text(msg.name, 24);
        const first = !db.users.some((u) => u.role !== "guest");
        if (!USERNAME_RE.test(username) || username.startsWith("tamu.")) return authError("Username 3–20 karakter: huruf kecil, angka, titik, atau garis bawah.");
        if (password.length < 6) return authError("Password minimal 6 karakter.");
        if (!name) return authError("Nama tampilan wajib diisi.");
        if (db.users.some((x) => x.username === username)) return authError("Username sudah dipakai.");
        if (!first && db.settings.registration === "invite" && text(msg.invite, 40) !== db.settings.inviteCode) {
          return authError("Pendaftaran butuh kode undangan dari admin.");
        }
        const { salt, hash } = hashPassword(password);
        const u: User = {
          id: newId(),
          username,
          name,
          passHash: hash,
          salt,
          role: first ? "admin" : "member", // pendaftar pertama otomatis admin
          disabled: false,
          avatar: null,
          ical: null,
          createdAt: Date.now(),
          lastPos: null,
          tourPending: true,
        };
        db.users.push(u);
        save();
        pushAdminState();
        return authOk(u, createSession(u.id));
      }
      return;
    }

    // ----- masuk ke kantor -----
    if (!me) {
      if (msg?.t === "logout") {
        delete db.sessions[String(msg.token)];
        save();
        return ws.close();
      }
      if (msg?.t !== "enter") return;
      const user: User = authed;
      if (msg.avatar) user.avatar = sanitizeAvatar(msg.avatar);
      if (!user.avatar) return send(ws, { t: "need_avatar" });
      // Satu akun satu koneksi: koneksi lama (tab/perangkat lain) dikeluarkan.
      const old = players.get(user.id);
      if (old) {
        send(old.ws, { t: "kicked", reason: "Akun ini masuk dari tab atau perangkat lain." });
        old.ws.close();
        dropPlayer(old);
      }
      if (players.size >= MAX_PLAYERS) {
        send(ws, { t: "full" });
        return ws.close();
      }
      const floor = layout.floors.some((f) => f.id === msg.floor) ? msg.floor : layout.floors.some((f) => f.id === user.lastFloor) ? user.lastFloor! : firstFloor();
      const spawn = validVec3(msg.p) ?? (floor === user.lastFloor ? user.lastPos : null) ?? randomSpawn();
      const pl: Player = { id: user.id, user, ws, token, floor, p: spawn, r: 0, a: 0, dirty: false, alive: true, manual: "available", idle: false, hand: false, zone: null };
      pl.zone = zoneAt(pl.floor, pl.p);
      me = pl;
      players.set(pl.id, pl);
      save();
      send(ws, {
        t: "welcome",
        id: pl.id,
        floor: pl.floor,
        spawn: pl.p,
        layout,
        players: [...players.values()].filter((o) => o !== pl).map(publicView),
        umum: db.umum.slice(-60),
      });
      send(ws, worldView());
      send(ws, bookingsView());
      sendScreens(pl);
      send(ws, { t: "directory", users: directory() });
      broadcast({ t: "join", player: publicView(pl) }, pl.id);
      broadcast(worldView(), pl.id);
      markDirectory();
      pushAdminState();
      mediaToken(pl.id, user.name)
        .then((tok) => send(ws, { t: "media", url: LIVEKIT_URL, token: tok }))
        .catch((err) => console.error("Gagal membuat token LiveKit:", err));
      refreshCalendar(user);
      console.log(`+ ${user.name} (@${user.username}) — ${players.size} online`);
      return;
    }

    handle(me, msg);
  });

  ws.on("pong", () => {
    if (me) me.alive = true;
  });

  ws.on("close", () => {
    if (me && players.get(me.id) === me) dropPlayer(me);
  });
});

function dropPlayer(pl: Player) {
  players.delete(pl.id);
  pl.user.lastPos = pl.p;
  pl.user.lastFloor = pl.floor;
  const myDesk = deskOf(pl.id);
  if (myDesk) lockedDesks.delete(myDesk); // mode fokus berakhir saat pemilik keluar
  c4LeaveAll(pl);
  save();
  broadcast({ t: "leave", id: pl.id });
  broadcast(worldView());
  markDirectory();
  pushAdminState();
  console.log(`- ${pl.user.name} — ${players.size} online`);
}

// ---------- pesan dari pemain yang sudah masuk ----------

function handle(me: Player, msg: any) {
  switch (msg?.t) {
    case "move": {
      const p = validVec3(msg.p);
      if (!p || !isNum(msg.r)) return;
      me.p = p;
      me.r = msg.r;
      me.a = Number.isInteger(msg.a) && msg.a >= 0 && msg.a < ANIM_COUNT ? msg.a : 0;
      me.dirty = true;
      setZone(me);
      return;
    }
    case "floor": {
      // Naik lift: pindah lantai, muncul di titik keluar lift lantai tujuan.
      const target = derived[String(msg.floor)];
      if (!target || msg.floor === me.floor) return;
      const lift = target.elevators[0];
      c4LeaveAll(me);
      me.floor = target.floorId;
      me.p = validVec3(msg.p) ?? (lift ? [lift.exit[0], 0, lift.exit[1]] : randomSpawn());
      me.zone = null;
      setZone(me);
      me.hand = false;
      broadcast({ t: "player", id: me.id, floor: me.floor, p: me.p }, me.id);
      markDirectory();
      return;
    }
    case "avatar": {
      me.user.avatar = sanitizeAvatar(msg.avatar);
      save();
      broadcast({ t: "player", id: me.id, avatar: me.user.avatar }, me.id);
      return;
    }
    case "settings": {
      const name = msg.name !== undefined ? text(msg.name, 24) : null;
      if (name) me.user.name = name;
      if (msg.ical !== undefined && me.user.role !== "guest") {
        const url = text(msg.ical, 500);
        me.user.ical = /^(https?|webcal):\/\//i.test(url) ? url : null;
        calendarBusy.delete(me.id);
        calendarCache.delete(me.id);
        refreshCalendar(me.user);
      }
      save();
      send(me.ws, { t: "settings_ok", user: selfView(me.user) });
      broadcast({ t: "player", id: me.id, name: me.user.name }, me.id);
      broadcast(worldView());
      markDirectory();
      return;
    }
    case "password": {
      if (me.user.role === "guest") return;
      const next = String(msg.new ?? "");
      if (!verifyPassword(String(msg.old ?? ""), me.user.salt, me.user.passHash)) return send(me.ws, { t: "notice", text: "Password lama salah." });
      if (next.length < 6) return send(me.ws, { t: "notice", text: "Password baru minimal 6 karakter." });
      const { salt, hash } = hashPassword(next);
      me.user.salt = salt;
      me.user.passHash = hash;
      // Sesi lain (perangkat lain) dikeluarkan; sesi ini tetap.
      for (const [tok, s] of Object.entries(db.sessions)) if (s.userId === me.id && tok !== me.token) delete db.sessions[tok];
      save();
      send(me.ws, { t: "password_ok" });
      return;
    }
    case "upload": {
      const name = text(msg.name, 120).replace(/[\\/]/g, "_") || "file";
      const mime = /^[\w.+-]+\/[\w.+-]+$/.test(msg.mime) ? String(msg.mime).toLowerCase() : "application/octet-stream";
      const data = typeof msg.data === "string" ? Buffer.from(msg.data, "base64") : null;
      if (!data || data.length === 0) return send(me.ws, { t: "upload_error", req: msg.req, reason: "File kosong." });
      if (data.length > MAX_UPLOAD) return send(me.ws, { t: "upload_error", req: msg.req, reason: "Maksimal 5 MB per file." });
      const id = newId() + newId();
      writeFileSync(resolve(UPLOAD_DIR, id), data);
      db.files[id] = { id, name, mime, size: data.length, by: me.id, ts: Date.now() };
      save();
      send(me.ws, { t: "upload_ok", req: msg.req, file: { id, name, mime, size: data.length } });
      return;
    }
    case "chat": {
      const body = text(msg.text, 500);
      const file = fileRef(msg.file);
      if (!body && !file) return;
      const base = { id: me.id, mid: newId(), name: me.user.name, text: body, ts: Date.now(), file };
      if (msg.channel === "umum") {
        pushCapped(db.umum, { id: base.mid, from: me.id, name: me.user.name, text: body, ts: base.ts, file }, 300);
        save();
        broadcast({ t: "chat", channel: "umum", ...base });
        return;
      }
      // Chat area: hanya orang yang juga bisa mendengar.
      const zone = me.zone;
      sendTo(areaAudience(me), { t: "chat", channel: "area", scope: zone?.name ?? "Sekitar", ...base });
      return;
    }
    case "dm": {
      const to = userById(String(msg.to));
      const body = text(msg.text, 1000);
      const file = fileRef(msg.file);
      if (!to || to.id === me.id || (!body && !file)) return;
      const m: ChatMsg = { id: newId(), from: me.id, name: me.user.name, to: to.id, text: body, ts: Date.now(), file };
      pushCapped((db.dms[dmKey(me.id, to.id)] ??= []), m, 300);
      save();
      send(me.ws, { t: "dm", msg: m });
      const target = players.get(to.id);
      if (target) send(target.ws, { t: "dm", msg: m });
      return;
    }
    case "dm_history": {
      const other = String(msg.with);
      send(me.ws, { t: "dm_history", with: other, messages: (db.dms[dmKey(me.id, other)] ?? []).slice(-100) });
      return;
    }
    case "react": {
      const emoji = String(msg.emoji);
      if (!REACTIONS.has(emoji)) return;
      const list = msg.channel === "umum" ? db.umum : msg.channel === "dm" ? db.dms[dmKey(me.id, String(msg.with))] : undefined;
      const m = list?.find((x) => x.id === msg.id);
      if (!m) return;
      const r = (m.reactions ??= {});
      const users = (r[emoji] ??= []);
      const i = users.indexOf(me.id);
      if (i >= 0) users.splice(i, 1);
      else users.push(me.id);
      if (!users.length) delete r[emoji];
      save();
      const update = { t: "reaction", channel: msg.channel, id: m.id, reactions: m.reactions, with: undefined as string | undefined };
      if (msg.channel === "umum") broadcast(update);
      else {
        const other = m.from === me.id ? m.to! : m.from;
        send(me.ws, { ...update, with: other });
        const target = players.get(other);
        if (target) send(target.ws, { ...update, with: me.id });
      }
      return;
    }
    case "search": {
      const q = text(msg.q, 80).toLowerCase();
      if (q.length < 2) return send(me.ws, { t: "search_result", q, results: [] });
      const hit = (m: ChatMsg) => m.text.toLowerCase().includes(q) || (m.file?.name.toLowerCase().includes(q) ?? false);
      const results: (ChatMsg & { channel: string; with?: string })[] = [];
      for (const m of db.umum) if (hit(m)) results.push({ ...m, channel: "umum" });
      for (const [key, list] of Object.entries(db.dms)) {
        const [a, b] = key.split("|");
        if (a !== me.id && b !== me.id) continue; // hanya DM milik sendiri
        const other = a === me.id ? b : a;
        for (const m of list) if (hit(m)) results.push({ ...m, channel: "dm", with: other });
      }
      results.sort((x, y) => y.ts - x.ts);
      send(me.ws, { t: "search_result", q, results: results.slice(0, 40) });
      return;
    }
    case "status": {
      if (["available", "busy", "away"].includes(msg.manual)) me.manual = msg.manual;
      if (typeof msg.idle === "boolean") me.idle = msg.idle;
      markDirectory();
      return;
    }
    case "summon": {
      const target = players.get(String(msg.to));
      if (!target || target === me) return;
      send(target.ws, { t: "summon", from: me.id, name: me.user.name, place: me.zone?.name ?? null, floor: me.floor, floorName: floorName(me.floor), p: me.p });
      return;
    }
    case "tour_done": {
      // Tur pertama selesai atau dilewati: tidak muncul otomatis lagi di perangkat mana pun.
      if (me.user.tourPending) {
        delete me.user.tourPending;
        save();
      }
      send(me.ws, { t: "tour_ok" });
      return;
    }
    case "hand": {
      me.hand = !!msg.up;
      markDirectory();
      return;
    }
    case "mute_room": {
      const zone = me.zone;
      if (zone?.kind !== "room" && !zone?.stage) return;
      sendTo((pl) => pl !== me && pl.floor === me.floor && pl.zone?.id === zone.id, { t: "mute_request", by: me.user.name });
      return;
    }
    case "desk": {
      if (me.user.role === "guest") return send(me.ws, { t: "notice", text: "Tamu tidak bisa mengklaim meja." });
      const mine = deskOf(me.id);
      if (msg.action === "claim") {
        // Satu orang satu meja; klaim meja baru melepas meja lama. Kepemilikan disimpan permanen.
        const id = String(msg.id);
        if (!allZones().some((z) => z.id === id && z.kind === "desk") || db.deskOwners[id]) return;
        if (mine) {
          delete db.deskOwners[mine];
          lockedDesks.delete(mine);
        }
        db.deskOwners[id] = me.id;
      } else if (msg.action === "release") {
        if (!mine) return;
        delete db.deskOwners[mine];
        lockedDesks.delete(mine);
      } else if (msg.action === "lock" || msg.action === "unlock") {
        if (!mine) return;
        if (msg.action === "lock") lockedDesks.add(mine);
        else lockedDesks.delete(mine);
      } else return;
      save();
      broadcast(worldView());
      markDirectory();
      return;
    }
    case "door": {
      const door = doors.get(String(msg.id));
      if (!door) return;
      const inside = insideRoom(msg.id, me);
      switch (msg.action) {
        case "open":
        case "close":
          if (door.locked && !inside) return; // pintu terkunci hanya bisa dibuka dari dalam
          door.open = msg.action === "open";
          if (door.open) door.locked = false;
          break;
        case "lock":
        case "unlock":
          if (!inside) return;
          door.locked = msg.action === "lock";
          if (door.locked) door.open = false;
          break;
        case "knock":
          if (inside || !door.locked) return;
          sendTo((pl) => pl !== me && insideRoom(msg.id, pl), { t: "knock", doorId: msg.id, name: me.user.name });
          return;
        default:
          return;
      }
      broadcast(worldView());
      return;
    }
    // ----- booking ruangan -----
    case "book": {
      if (me.user.role === "guest") return send(me.ws, { t: "notice", text: "Tamu tidak bisa memesan ruangan." });
      const room = allRooms().find((r) => r.id === msg.room);
      const title = text(msg.title, 60) || "Rapat";
      const start = isNum(msg.start) ? Math.round(msg.start / 60_000) * 60_000 : NaN;
      const end = isNum(msg.end) ? Math.round(msg.end / 60_000) * 60_000 : NaN;
      if (!room || !(end > start)) return send(me.ws, { t: "notice", text: "Waktu booking tidak valid." });
      if (end - start < 15 * 60_000 || end - start > 8 * 3600_000) return send(me.ws, { t: "notice", text: "Durasi booking 15 menit sampai 8 jam." });
      if (end < Date.now()) return send(me.ws, { t: "notice", text: "Waktu booking sudah lewat." });
      const clash = db.bookings.find((b) => b.room === room.id && b.start < end && start < b.end);
      if (clash) return send(me.ws, { t: "notice", text: `Bentrok dengan "${clash.title}" oleh ${clash.byName}.` });
      db.bookings.push({ id: newId(), room: room.id, title, start, end, by: me.id, byName: me.user.name });
      save();
      broadcast(bookingsView());
      return;
    }
    case "unbook": {
      const b = db.bookings.find((x) => x.id === msg.id);
      if (!b || (b.by !== me.id && me.user.role !== "admin")) return;
      db.bookings = db.bookings.filter((x) => x !== b);
      save();
      broadcast(bookingsView());
      return;
    }
    // ----- website di layar presentasi (hanya orang di area/ruangan layar itu) -----
    case "screen_url": {
      const item = layout.floors.flatMap((f) => f.items.map((i) => ({ i, f: f.id }))).find(({ i }) => i.id === msg.item && i.type === "screen");
      if (!item) return;
      const zone = zoneIn(derived[item.f], item.i.x, item.i.z, true);
      if (!zone || me.zone?.id !== zone.id) return send(me.ws, { t: "notice", text: "Masuk ke ruangan layar itu dulu." });
      const url = text(msg.url, 1000);
      if (url && !/^https:\/\//i.test(url)) return send(me.ws, { t: "notice", text: "Alamat website harus diawali https://" });
      if (url) db.screens[item.i.id] = url;
      else delete db.screens[item.i.id];
      save();
      for (const pl of players.values()) sendScreens(pl);
      return;
    }
    // ----- whiteboard per ruangan (hanya orang di dalam ruangan yang bisa melihat & menggambar) -----
    case "wb_open": {
      if (!insideRoom(msg.room, me)) return;
      send(me.ws, { t: "wb_state", room: msg.room, strokes: db.whiteboards[msg.room] ?? [] });
      return;
    }
    case "wb_stroke": {
      const stroke = sanitizeStroke(msg.stroke);
      if (!stroke || !insideRoom(msg.room, me)) return;
      const list = (db.whiteboards[msg.room] ??= []);
      const idx = list.findIndex((s) => s.id === stroke.id);
      if (idx >= 0) list[idx] = stroke;
      else pushCapped(list, stroke, 1500);
      save();
      sendTo((pl) => pl !== me && insideRoom(msg.room, pl), { t: "wb_stroke", room: msg.room, stroke });
      return;
    }
    case "wb_clear": {
      if (!insideRoom(msg.room, me)) return;
      db.whiteboards[msg.room] = [];
      save();
      sendTo((pl) => insideRoom(msg.room, pl), { t: "wb_clear", room: msg.room });
      return;
    }
    // ----- game arcade -----
    case "arcade_scores": {
      const game = String(msg.game);
      if (ARCADE_GAMES.has(game)) send(me.ws, { t: "arcade_scores", game, top: db.scores[game] ?? [] });
      return;
    }
    case "arcade_score": {
      const game = String(msg.game);
      const score = msg.score;
      if (!ARCADE_GAMES.has(game) || !Number.isInteger(score) || score <= 0 || score > SCORE_MAX) return;
      if (!gameItemNear(me, msg.machine, "arcade")) return;
      const list = (db.scores[game] ??= []);
      const mine = list.find((e) => e.userId === me.id);
      if (mine && mine.score >= score) return;
      if (mine) Object.assign(mine, { score, name: me.user.name, ts: Date.now() });
      else list.push({ userId: me.id, name: me.user.name, score, ts: Date.now() });
      list.sort((a, b) => b.score - a.score || a.ts - b.ts);
      list.splice(SCORE_TOP);
      save();
      sendTo((pl) => pl.floor === me.floor, { t: "arcade_scores", game, top: list });
      return;
    }
    case "c4_open": {
      if (!gameItemNear(me, msg.table, "gameTable")) return;
      send(me.ws, c4View(String(msg.table), c4Games.get(String(msg.table))));
      return;
    }
    case "c4_join": {
      if (!gameItemNear(me, msg.table, "gameTable")) return;
      const table = String(msg.table);
      let g = c4Games.get(table);
      if (g?.seats.includes(me)) return;
      const seat = msg.seat === 0 || msg.seat === 1 ? (g?.seats[msg.seat] ? -1 : msg.seat) : g ? g.seats.indexOf(null) : 0;
      if (seat < 0) return send(me.ws, { t: "notice", text: "Kursi itu sudah terisi." });
      c4LeaveAll(me); // satu orang satu meja
      if (!g) c4Games.set(table, (g = { floor: me.floor, board: c4Empty(), seats: [null, null], turn: 1, result: 0, last: null }));
      g.seats[seat] = me;
      c4Reset(g);
      c4Push(table, g);
      return;
    }
    case "c4_leave": {
      c4LeaveAll(me);
      return;
    }
    case "c4_drop": {
      const table = String(msg.table);
      const g = c4Games.get(table);
      if (!g || g.result || !g.seats[0] || !g.seats[1] || g.seats[g.turn - 1] !== me) return;
      if (!gameItemNear(me, table, "gameTable")) return;
      const row = c4Drop(g.board, msg.col, g.turn);
      if (row < 0) return;
      g.last = row * C4_COLS + msg.col;
      g.result = c4Result(g.board);
      if (!g.result) g.turn = g.turn === 1 ? 2 : 1;
      c4Push(table, g);
      return;
    }
    case "c4_reset": {
      const table = String(msg.table);
      const g = c4Games.get(table);
      if (!g || !g.seats.includes(me)) return;
      c4Reset(g);
      c4Push(table, g);
      return;
    }
    // ----- admin -----
    case "layout": {
      if (me.user.role !== "admin") return;
      const next = msg.reset ? defaultLayout() : sanitizeLayout(msg.layout);
      if (!next) return send(me.ws, { t: "notice", text: "Denah tidak valid, perubahan ditolak." });
      layout = next;
      derived = derive(layout);
      db.layout = layout;
      const zones = allZones();
      for (const id of Object.keys(db.deskOwners)) if (!zones.some((z) => z.id === id)) delete db.deskOwners[id];
      for (const id of lockedDesks) if (!db.deskOwners[id]) lockedDesks.delete(id);
      syncDoors();
      for (const pl of players.values()) {
        if (!derived[pl.floor]) {
          // Lantainya dihapus → pindahkan ke lantai pertama.
          pl.floor = firstFloor();
          pl.p = randomSpawn();
          send(pl.ws, { t: "move_to", floor: pl.floor, p: pl.p });
          broadcast({ t: "player", id: pl.id, floor: pl.floor, p: pl.p }, pl.id);
        }
        pl.zone = zoneAt(pl.floor, pl.p);
        sendScreens(pl);
      }
      save();
      broadcast({ t: "layout", layout }, msg.reset ? undefined : me.id);
      broadcast(worldView());
      markDirectory();
      return;
    }
    case "admin": {
      if (me.user.role !== "admin") return;
      const target = msg.userId ? userById(String(msg.userId)) : undefined;
      switch (msg.action) {
        case "kick":
        case "disable": {
          if (!target || target.id === me.id) return;
          if (msg.action === "disable") {
            target.disabled = true;
            for (const [tok, s] of Object.entries(db.sessions)) if (s.userId === target.id) delete db.sessions[tok];
          }
          const pl = players.get(target.id);
          if (pl) {
            send(pl.ws, { t: "kicked", reason: msg.action === "disable" ? "Akunmu dinonaktifkan admin." : "Kamu dikeluarkan oleh admin." });
            pl.ws.close();
          }
          break;
        }
        case "enable":
          if (!target) return;
          target.disabled = false;
          break;
        case "role":
          if (!target || target.id === me.id || target.role === "guest" || !["admin", "member"].includes(msg.role)) return;
          target.role = msg.role;
          break;
        case "reset_password": {
          if (!target || target.role === "guest") return;
          const temp = newToken().replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
          const { salt, hash } = hashPassword(temp);
          target.salt = salt;
          target.passHash = hash;
          for (const [tok, s] of Object.entries(db.sessions)) if (s.userId === target.id) delete db.sessions[tok];
          const pl = players.get(target.id);
          if (pl) {
            send(pl.ws, { t: "kicked", reason: "Password-mu direset admin. Masuk lagi dengan password sementara dari admin." });
            pl.ws.close();
          }
          send(me.ws, { t: "temp_password", userId: target.id, username: target.username, password: temp });
          break;
        }
        case "registration":
          if (!["open", "invite"].includes(msg.mode)) return;
          db.settings.registration = msg.mode;
          break;
        case "new_invite":
          db.settings.inviteCode = Math.random().toString(36).slice(2, 10);
          break;
        case "guest_link": {
          const hours = isNum(msg.hours) ? Math.min(24 * 14, Math.max(1, Math.round(msg.hours))) : 24;
          db.guestLinks[newToken()] = { label: text(msg.label, 60) || "Tamu", exp: Date.now() + hours * 3600_000, createdBy: me.id };
          break;
        }
        case "guest_revoke":
          delete db.guestLinks[String(msg.token)];
          break;
        default:
          return;
      }
      save();
      pushAdminState();
      markDirectory();
      return;
    }
  }
}

// ---------- kalender ----------

async function refreshCalendar(u: User) {
  if (!u.ical) {
    calendarCache.delete(u.id);
    if (calendarBusy.delete(u.id)) markDirectory();
    return;
  }
  try {
    calendarCache.set(u.id, await fetchCalendar(u.ical));
    updateCalendarStatus();
  } catch (err) {
    console.warn(`Kalender @${u.username} gagal dibaca:`, (err as Error).message);
  }
}

function updateCalendarStatus() {
  const now = Date.now();
  for (const [uid, events] of calendarCache) {
    const ev = busyAt(events, now);
    if (!!ev !== !!calendarBusy.get(uid)) markDirectory();
    calendarBusy.set(uid, ev);
  }
}
setInterval(() => {
  for (const pl of players.values()) refreshCalendar(pl.user);
}, 5 * 60_000);
setInterval(updateCalendarStatus, 30_000);

// ---------- tick ----------

setInterval(() => {
  // Ruangan kosong → kunci pintu terbuka otomatis supaya tidak terkunci selamanya.
  for (const [id, door] of doors) {
    if (door.locked && ![...players.values()].some((pl) => insideRoom(id, pl))) {
      door.locked = false;
      broadcast(worldView());
    }
  }
  const u: (string | number)[][] = [];
  for (const pl of players.values()) {
    if (!pl.dirty) continue;
    pl.dirty = false;
    u.push([pl.id, ...pl.p.map((n) => Math.round(n * 100) / 100), Math.round(pl.r * 100) / 100, pl.a]);
  }
  if (u.length) broadcast({ t: "state", ts: Date.now(), u });
}, 1000 / TICK_HZ);

// Direktori (status, lokasi) dikirim paling sering sekali per detik — perubahan area terjadi terus saat orang berjalan.
setInterval(() => {
  if (!directoryDirty) return;
  directoryDirty = false;
  broadcast({ t: "directory", users: directory() });
}, 1000);

// Putuskan koneksi yang mati (tab ditutup paksa, jaringan putus).
setInterval(() => {
  for (const pl of players.values()) {
    if (!pl.alive) {
      pl.ws.terminate();
      continue;
    }
    pl.alive = false;
    pl.ws.ping();
  }
}, 15000);

// Tiap menit: akun tamu & link tamu yang kedaluwarsa dihapus.
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const u of db.users.filter((x) => x.guestExp && x.guestExp < now)) {
    const pl = players.get(u.id);
    if (pl) {
      send(pl.ws, { t: "kicked", reason: "Waktu kunjungan tamu sudah habis. Terima kasih sudah mampir!" });
      pl.ws.close();
    }
    db.users = db.users.filter((x) => x !== u);
    for (const [tok, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[tok];
    changed = true;
  }
  for (const [tok, g] of Object.entries(db.guestLinks)) if (g.exp < now) delete db.guestLinks[tok];
  db.bookings = db.bookings.filter((b) => b.end > now - 7 * 86_400_000);
  if (changed) {
    save();
    pushAdminState();
    markDirectory();
  }
}, 60_000);

// Sesi kedaluwarsa dibersihkan & database dicadangkan berkala.
setInterval(() => {
  const now = Date.now();
  for (const [tok, s] of Object.entries(db.sessions)) if (s.exp < now) delete db.sessions[tok];
  save();
}, 86_400_000);
setInterval(() => {
  try {
    flush();
    backup();
  } catch (err) {
    console.warn("Backup gagal:", err);
  }
}, 6 * 3600_000);

process.on("exit", flush);
http.listen(PORT, () => console.log(`Virtual office server jalan di ws://localhost:${PORT}${serveStatic ? " (+ web di http://localhost:" + PORT + ")" : ""}`));
