import { WebSocketServer, WebSocket } from "ws";
import { AccessToken } from "livekit-server-sdk";
import { sanitizeAvatar } from "./avatar.js";
import { db, dmKey, flush, pushCapped, save, type Stroke, type User } from "./store.js";
import { SESSION_DAYS, USERNAME_RE, hashPassword, newId, newToken, verifyPassword } from "./auth.js";
import { busyAt, fetchCalendar, type CalEvent } from "./calendar.js";
import { PROXIMITY, defaultLayout, derive, sanitizeLayout, zoneIn, type Layout, type Zone } from "../../shared/layout.js";

try {
  process.loadEnvFile();
} catch {
  /* .env opsional */
}

// Protokol (JSON lewat WebSocket). Alur: login/register/resume → auth_ok → enter → welcome.
//   client → server: login | register | resume | enter {avatar?, p?} | move | avatar | settings {name?, ical?} | logout
//                    | chat {channel: area|umum, text} | dm {to, text} | dm_history {with} | status {manual, idle}
//                    | summon {to} | hand {up} | mute_room | desk {action, id?} | door {id, action}
//                    | wb_open {room} | wb_stroke {room, stroke} | wb_clear {room} | layout {layout|reset} | admin {action, ...}
//   server → client: auth_ok | auth_error | need_avatar | kicked | welcome | media | join | leave | player | state | world
//                    | layout | directory | chat | dm | dm_history | summon | knock | mute_request | wb_state | wb_stroke
//                    | wb_clear | admin_state | settings_ok | notice | full

type Vec3 = [number, number, number];
type Manual = "available" | "busy" | "away";

interface Player {
  id: string; // = id user
  user: User;
  ws: WebSocket;
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

// Default = `livekit-server --dev` lokal. Untuk LiveKit Cloud isi .env (lihat .env.example).
// Tanpa LIVEKIT_URL, client memakai host halaman (port 7880) supaya tetap jalan dari perangkat lain di LAN.
const LIVEKIT_URL = process.env.LIVEKIT_URL || null;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "secret";
const LIVEKIT_ROOM = process.env.LIVEKIT_ROOM ?? "office";

async function mediaToken(id: string, name: string) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: id, name, ttl: "8h" });
  at.addGrant({ roomJoin: true, room: LIVEKIT_ROOM, canPublish: true, canSubscribe: true });
  return at.toJwt();
}

// ---------- denah & state dunia ----------

let layout: Layout = (db.layout && sanitizeLayout(db.layout)) || defaultLayout();
let derived = derive(layout);
const zoneAt = (p: Vec3) => zoneIn(derived, p[0], p[2]);

interface DoorState {
  open: boolean;
  locked: boolean;
}
const doors = new Map<string, DoorState>();
const lockedDesks = new Set<string>(); // id zona meja yang sedang mode fokus (berlaku selama pemilik online)

function syncDoors() {
  for (const d of derived.doors) if (!doors.has(d.id)) doors.set(d.id, { open: true, locked: false });
  for (const id of doors.keys()) if (!derived.doors.some((d) => d.id === id)) doors.delete(id);
}
syncDoors();

const players = new Map<string, Player>();
const userById = (id: string) => db.users.find((u) => u.id === id);
const deskOf = (userId: string) => Object.entries(db.deskOwners).find(([, uid]) => uid === userId)?.[0];

function worldView() {
  const desks: Record<string, { ownerId: string; ownerName: string; locked: boolean; online: boolean }> = {};
  for (const [deskId, ownerId] of Object.entries(db.deskOwners)) {
    const owner = userById(ownerId);
    if (!owner || !derived.zones.some((z) => z.id === deskId)) continue;
    desks[deskId] = { ownerId, ownerName: owner.name, locked: lockedDesks.has(deskId), online: players.has(ownerId) };
  }
  return { t: "world", desks, doors: Object.fromEntries(doors) };
}

const insideRoom = (roomId: unknown, pl: Player) => pl.zone?.id === `room:${roomId}`;

// ---------- presence & direktori ----------

const calendarCache = new Map<string, CalEvent[]>();
const calendarBusy = new Map<string, CalEvent | null>();

function statusOf(pl: Player): "available" | "busy" | "meeting" | "away" | "focus" {
  if (pl.manual === "busy") return "busy";
  if (pl.manual === "away") return "away";
  const myDesk = deskOf(pl.id);
  if (myDesk && lockedDesks.has(myDesk)) return "focus";
  if (calendarBusy.get(pl.id)) return "meeting";
  if (pl.zone?.kind === "room") return "meeting";
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

const publicView = (pl: Player) => ({ id: pl.id, name: pl.user.name, avatar: pl.user.avatar, p: pl.p, r: pl.r, a: pl.a });

const selfView = (u: User) => ({ id: u.id, username: u.username, name: u.name, role: u.role, avatar: u.avatar, ical: u.ical });

function adminState() {
  return {
    t: "admin_state",
    users: db.users.map((u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, disabled: u.disabled, online: players.has(u.id) })),
    registration: db.settings.registration,
    inviteCode: db.settings.inviteCode,
  };
}
const pushAdminState = () => sendTo((pl) => pl.user.role === "admin", adminState());

// ---------- util ----------

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const randomSpawn = (): Vec3 => [Math.random() * 10 - 5, 0, 7 + Math.random() * 4];

function validVec3(v: unknown): Vec3 | null {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) return null;
  return [clamp(v[0], WORLD_LIMIT), clamp(v[1], WORLD_LIMIT), clamp(v[2], WORLD_LIMIT)];
}

function createSession(userId: string) {
  const token = newToken();
  db.sessions[token] = { userId, exp: Date.now() + SESSION_DAYS * 86_400_000 };
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

// ---------- koneksi ----------

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  let authed: User | null = null;
  let me: Player | null = null;
  let attempts = 0;

  const authOk = (u: User, token: string) => {
    authed = u;
    send(ws, { t: "auth_ok", token, user: selfView(u) });
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
        const u = db.users.find((x) => x.username === text(msg.username, 40).toLowerCase());
        if (!u || !verifyPassword(String(msg.password ?? ""), u.salt, u.passHash)) return authError("Username atau password salah.");
        if (u.disabled) return authError("Akun ini dinonaktifkan admin.");
        return authOk(u, createSession(u.id));
      }
      if (msg?.t === "register") {
        const username = text(msg.username, 40).toLowerCase();
        const password = String(msg.password ?? "");
        const name = text(msg.name, 24);
        const first = db.users.length === 0;
        if (!USERNAME_RE.test(username)) return authError("Username 3–20 karakter: huruf kecil, angka, titik, atau garis bawah.");
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
      const spawn = validVec3(msg.p) ?? user.lastPos ?? randomSpawn();
      const pl: Player = { id: user.id, user, ws, p: spawn, r: 0, a: 0, dirty: false, alive: true, manual: "available", idle: false, hand: false, zone: null };
      pl.zone = zoneAt(pl.p);
      me = pl;
      players.set(pl.id, pl);
      save();
      send(ws, {
        t: "welcome",
        id: pl.id,
        spawn: pl.p,
        layout,
        players: [...players.values()].filter((o) => o !== pl).map(publicView),
        umum: db.umum.slice(-60),
      });
      send(ws, worldView());
      send(ws, { t: "directory", users: directory() });
      broadcast({ t: "join", player: publicView(pl) }, pl.id);
      broadcast(worldView(), pl.id);
      markDirectory();
      pushAdminState();
      mediaToken(pl.id, user.name)
        .then((token) => send(ws, { t: "media", url: LIVEKIT_URL, token }))
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
  const myDesk = deskOf(pl.id);
  if (myDesk) lockedDesks.delete(myDesk); // mode fokus berakhir saat pemilik keluar
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
      const z = zoneAt(p);
      if (z?.id !== me.zone?.id) {
        me.zone = z;
        markDirectory();
      }
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
      if (msg.ical !== undefined) {
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
    case "chat": {
      const body = text(msg.text, 500);
      if (!body) return;
      const base = { id: me.id, name: me.user.name, text: body, ts: Date.now() };
      if (msg.channel === "umum") {
        pushCapped(db.umum, { from: me.id, name: me.user.name, text: body, ts: base.ts }, 200);
        save();
        broadcast({ t: "chat", channel: "umum", ...base });
        return;
      }
      // Chat area: hanya orang yang juga bisa mendengar (satu area, atau dekat bila sama-sama di luar area).
      const zone = me.zone;
      sendTo(
        (pl) =>
          zone
            ? pl.zone?.id === zone.id
            : !pl.zone && Math.hypot(pl.p[0] - me.p[0], pl.p[2] - me.p[2]) <= PROXIMITY.hear + PROXIMITY.hysteresis,
        { t: "chat", channel: "area", scope: zone?.name ?? "Sekitar", ...base },
      );
      return;
    }
    case "dm": {
      const to = userById(String(msg.to));
      const body = text(msg.text, 1000);
      if (!to || to.id === me.id || !body) return;
      const m = { from: me.id, name: me.user.name, to: to.id, text: body, ts: Date.now() };
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
    case "status": {
      if (["available", "busy", "away"].includes(msg.manual)) me.manual = msg.manual;
      if (typeof msg.idle === "boolean") me.idle = msg.idle;
      markDirectory();
      return;
    }
    case "summon": {
      const target = players.get(String(msg.to));
      if (!target || target === me) return;
      send(target.ws, { t: "summon", from: me.id, name: me.user.name, place: me.zone?.name ?? null, p: me.p });
      return;
    }
    case "hand": {
      me.hand = !!msg.up;
      markDirectory();
      return;
    }
    case "mute_room": {
      const zone = me.zone;
      if (zone?.kind !== "room") return;
      sendTo((pl) => pl !== me && pl.zone?.id === zone.id, { t: "mute_request", by: me.user.name });
      return;
    }
    case "desk": {
      const mine = deskOf(me.id);
      if (msg.action === "claim") {
        // Satu orang satu meja; klaim meja baru melepas meja lama. Kepemilikan disimpan permanen.
        const id = String(msg.id);
        if (!derived.zones.some((z) => z.id === id && z.kind === "desk") || db.deskOwners[id]) return;
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
    // ----- admin -----
    case "layout": {
      if (me.user.role !== "admin") return;
      const next = msg.reset ? defaultLayout() : sanitizeLayout(msg.layout);
      if (!next) return send(me.ws, { t: "notice", text: "Denah tidak valid, perubahan ditolak." });
      layout = next;
      derived = derive(layout);
      db.layout = layout;
      for (const id of Object.keys(db.deskOwners)) if (!derived.zones.some((z) => z.id === id)) delete db.deskOwners[id];
      for (const id of lockedDesks) if (!db.deskOwners[id]) lockedDesks.delete(id);
      syncDoors();
      for (const pl of players.values()) pl.zone = zoneAt(pl.p);
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
          if (!target || target.id === me.id || !["admin", "member"].includes(msg.role)) return;
          target.role = msg.role;
          break;
        case "registration":
          if (!["open", "invite"].includes(msg.mode)) return;
          db.settings.registration = msg.mode;
          break;
        case "new_invite":
          db.settings.inviteCode = Math.random().toString(36).slice(2, 10);
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
  if (directoryDirty) {
    directoryDirty = false;
    broadcast({ t: "directory", users: directory() });
  }
}, 1000 / TICK_HZ);

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

// Bersihkan sesi kedaluwarsa sekali sehari.
setInterval(() => {
  const now = Date.now();
  for (const [tok, s] of Object.entries(db.sessions)) if (s.exp < now) delete db.sessions[tok];
  save();
}, 86_400_000);

process.on("exit", flush);
console.log(`Virtual office server jalan di ws://localhost:${PORT}`);
