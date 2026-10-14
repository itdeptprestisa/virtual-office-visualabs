import { create } from "zustand";
import { sanitizeAvatar, type AvatarConfig } from "./avatar/config";
import { derive, type Derived, type Layout } from "../../shared/layout";
import { setDerived } from "./zones";
import { notify } from "./notify";

export type Vec3 = [number, number, number];

export interface PlayerInfo {
  id: string;
  name: string;
  avatar: AvatarConfig;
}

export interface Me {
  id: string;
  username: string;
  name: string;
  role: "admin" | "member";
  avatar: AvatarConfig | null;
  ical: string | null;
}

export interface ChatMessage {
  id: string; // pengirim
  name: string;
  text: string;
  ts: number;
  scope?: string; // nama area (chat area)
}

export interface DmMessage {
  from: string;
  to: string;
  name: string;
  text: string;
  ts: number;
}

export type Presence = "available" | "busy" | "meeting" | "away" | "focus" | "offline";

export interface DirUser {
  id: string;
  username: string;
  name: string;
  role: "admin" | "member";
  online: boolean;
  status: Presence;
  calendar: boolean;
  zone: string | null;
  hand: boolean;
}

export interface DoorState {
  open: boolean;
  locked: boolean;
}

export interface DeskState {
  ownerId: string;
  ownerName: string;
  locked: boolean;
  online: boolean;
}

export interface AdminState {
  users: { id: string; username: string; name: string; role: "admin" | "member"; disabled: boolean; online: boolean }[];
  registration: "open" | "invite";
  inviteCode: string;
}

export type ChatTab = "area" | "umum" | `dm:${string}`;

type Phase = "boot" | "auth" | "avatar" | "entering" | "online" | "reconnecting" | "kicked";

interface NetState {
  phase: Phase;
  authError: string | null;
  kickedReason: string | null;
  me: Me | null;
  selfId: string | null;
  self: PlayerInfo | null;
  spawn: Vec3;
  players: Record<string, PlayerInfo>;
  layout: Layout | null;
  derived: Derived | null;
  directory: DirUser[];
  chat: { area: ChatMessage[]; umum: ChatMessage[] };
  dms: Record<string, DmMessage[]>;
  unread: Partial<Record<ChatTab, number>>;
  chatTab: ChatTab;
  chatOpen: boolean;
  openDms: string[];
  bubbles: Record<string, { text: string; ts: number }>;
  zone: string | null;
  zoneId: string | null;
  media: { url: string | null; token: string } | null;
  desks: Record<string, DeskState>;
  doors: Record<string, DoorState>;
  nearDoor: string | null;
  nearSeat: string | null;
  sitting: boolean;
  notice: { text: string; ts: number } | null;
  summon: { from: string; name: string; place: string | null; p: Vec3; ts: number } | null;
  admin: AdminState | null;
  manualStatus: "available" | "busy" | "away";
}

export const useNet = create<NetState>(() => ({
  phase: "boot",
  authError: null,
  kickedReason: null,
  me: null,
  selfId: null,
  self: null,
  spawn: [0, 0, 8],
  players: {},
  layout: null,
  derived: null,
  directory: [],
  chat: { area: [], umum: [] },
  dms: {},
  unread: {},
  chatTab: "area",
  chatOpen: true,
  openDms: [],
  bubbles: {},
  zone: null,
  zoneId: null,
  media: null,
  desks: {},
  doors: {},
  nearDoor: null,
  nearSeat: null,
  sitting: false,
  notice: null,
  summon: null,
  admin: null,
  manualStatus: "available",
}));

export const showNotice = (text: string) => useNet.setState({ notice: { text, ts: Date.now() } });

// Posisi pemain lain disimpan di luar React supaya update 15x/detik tidak memicu re-render.
// `p`/`r` = posisi terbaru (untuk proximity); `buf` = riwayat singkat untuk interpolasi visual yang mulus.
export interface Snapshot {
  t: number; // waktu lokal (ms, performance.now) saat posisi ini berlaku di server
  p: Vec3;
  r: number;
}
export interface RemoteState {
  p: Vec3;
  r: number;
  a: number;
  buf: Snapshot[];
}
export const remoteState = new Map<string, RemoteState>();

/** Posisi avatar sendiri (ditulis Player tiap frame) — dipakai saat menyambung ulang. */
export const selfPos: { p: Vec3 | null } = { p: null };

const BUFFER_SIZE = 20;
// Selisih jam server → jam lokal, diambil yang terkecil (= paket yang paling cepat sampai) supaya jitter jaringan tidak ikut.
let clockOffset = Infinity;

function pushSnapshot(id: string, p: Vec3, r: number, a: number, t: number) {
  const prev = remoteState.get(id);
  const buf = prev?.buf ?? [];
  buf.push({ t, p, r });
  if (buf.length > BUFFER_SIZE) buf.shift();
  remoteState.set(id, { p, r, a, buf });
}

/** Terapkan denah (dari server, atau perubahan lokal editor sebelum dikirim). */
export function applyLayout(layout: Layout) {
  const derived = derive(layout);
  setDerived(derived);
  useNet.setState({ layout, derived });
}

// ---------- koneksi, login & sambung ulang ----------

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? `ws://${location.hostname}:2567`;
const TOKEN_KEY = "vo-token";
let ws: WebSocket | null = null;
let retry = 0;
let stopped = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* mode privat */
    }
  },
};

function send(msg: unknown) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function open(first: unknown) {
  const prev = ws;
  ws = null;
  prev?.close();
  const sock = new WebSocket(SERVER_URL);
  ws = sock;
  sock.onopen = () => sock.send(JSON.stringify(first));
  sock.onmessage = (ev) => handle(JSON.parse(ev.data));
  sock.onclose = () => {
    if (ws !== sock || stopped) return;
    const { phase } = useNet.getState();
    if (phase === "online" || phase === "reconnecting" || phase === "entering") {
      // Putus di tengah jalan → sambung ulang otomatis dengan token (backoff 1s, 2s, 4s … maks 10s).
      useNet.setState({ phase: "reconnecting" });
      const delay = Math.min(10_000, 1000 * 2 ** retry++);
      reconnectTimer = setTimeout(resume, delay);
    } else if (phase === "boot" || phase === "auth") {
      useNet.setState({ phase: "auth", authError: "Tidak bisa terhubung ke server." });
    }
  };
}

function resume() {
  const token = storage.get(TOKEN_KEY);
  if (!token) return useNet.setState({ phase: "auth" });
  open({ t: "resume", token });
}

/** Dipanggil sekali saat aplikasi dibuka: masuk otomatis bila masih ada sesi. */
export function boot() {
  if (storage.get(TOKEN_KEY)) resume();
  else useNet.setState({ phase: "auth" });
}

export function login(username: string, password: string) {
  useNet.setState({ authError: null });
  open({ t: "login", username, password });
}

export function register(username: string, password: string, name: string, invite: string) {
  useNet.setState({ authError: null });
  open({ t: "register", username, password, name, invite });
}

export function enter(avatar?: AvatarConfig) {
  if (avatar) useNet.setState((s) => ({ me: s.me && { ...s.me, avatar } })); // avatar pertama user baru
  if (useNet.getState().phase !== "reconnecting") useNet.setState({ phase: "entering" });
  send({ t: "enter", avatar, p: selfPos.p ?? undefined });
}

export function logout() {
  stopped = true;
  send({ t: "logout", token: storage.get(TOKEN_KEY) });
  storage.set(TOKEN_KEY, null);
  setTimeout(() => location.reload(), 150);
}

// ---------- pesan masuk ----------

const isViewing = (tab: ChatTab) => {
  const s = useNet.getState();
  return s.chatOpen && s.chatTab === tab && !document.hidden;
};

function addUnread(tab: ChatTab) {
  if (isViewing(tab)) return;
  useNet.setState((s) => ({ unread: { ...s.unread, [tab]: (s.unread[tab] ?? 0) + 1 } }));
}

function mentionsMe(text: string) {
  const me = useNet.getState().me;
  return !!me && new RegExp(`@${me.username.replace(/\./g, "\\.")}\\b`, "i").test(text);
}

function handle(msg: any) {
  switch (msg.t) {
    case "auth_ok": {
      retry = 0;
      storage.set(TOKEN_KEY, msg.token);
      const me: Me = { ...msg.user, avatar: msg.user.avatar ? sanitizeAvatar(msg.user.avatar) : null };
      useNet.setState({ me, authError: null });
      if (me.avatar) enter();
      else useNet.setState({ phase: "avatar" });
      break;
    }
    case "auth_error":
      storage.set(TOKEN_KEY, null);
      useNet.setState({ phase: "auth", authError: msg.reason });
      break;
    case "need_avatar":
      useNet.setState({ phase: "avatar" });
      break;
    case "kicked":
      stopped = true;
      useNet.setState({ phase: "kicked", kickedReason: msg.reason });
      break;
    case "welcome": {
      remoteState.clear();
      const players: Record<string, PlayerInfo> = {};
      for (const pl of msg.players) {
        players[pl.id] = { id: pl.id, name: pl.name, avatar: sanitizeAvatar(pl.avatar) };
        pushSnapshot(pl.id, pl.p, pl.r, pl.a, performance.now());
      }
      applyLayout(msg.layout);
      const me = useNet.getState().me!;
      const umum: ChatMessage[] = msg.umum.map((m: any) => ({ id: m.from, name: m.name, text: m.text, ts: m.ts }));
      useNet.setState((s) => ({
        phase: "online",
        selfId: msg.id,
        self: { id: msg.id, name: me.name, avatar: me.avatar! },
        spawn: s.self ? s.spawn : msg.spawn, // saat menyambung ulang, posisi lokal dipertahankan
        players,
        chat: { ...s.chat, umum },
      }));
      sendStatus();
      break;
    }
    case "layout":
      applyLayout(msg.layout);
      break;
    case "join": {
      const pl = msg.player;
      pushSnapshot(pl.id, pl.p, pl.r, pl.a, performance.now());
      useNet.setState((s) => ({ players: { ...s.players, [pl.id]: { id: pl.id, name: pl.name, avatar: sanitizeAvatar(pl.avatar) } } }));
      break;
    }
    case "leave": {
      remoteState.delete(msg.id);
      useNet.setState((s) => {
        const { [msg.id]: _, ...players } = s.players;
        return { players };
      });
      break;
    }
    case "player": {
      const info = useNet.getState().players[msg.id];
      if (!info) break;
      useNet.setState((s) => ({
        players: {
          ...s.players,
          [msg.id]: { ...info, ...(msg.name ? { name: msg.name } : {}), ...(msg.avatar ? { avatar: sanitizeAvatar(msg.avatar) } : {}) },
        },
      }));
      break;
    }
    case "state": {
      const selfId = useNet.getState().selfId;
      clockOffset = Math.min(clockOffset, performance.now() - msg.ts);
      const t = msg.ts + clockOffset;
      for (const [id, x, y, z, r, a] of msg.u) {
        if (id === selfId) continue;
        pushSnapshot(id, [x, y, z], r, a, t);
      }
      break;
    }
    case "directory":
      useNet.setState({ directory: msg.users });
      break;
    case "chat": {
      const c: ChatMessage = { id: msg.id, name: msg.name, text: msg.text, ts: msg.ts, scope: msg.scope };
      const tab: ChatTab = msg.channel === "umum" ? "umum" : "area";
      const mine = msg.id === useNet.getState().selfId;
      useNet.setState((s) => ({
        chat: { ...s.chat, [tab]: [...s.chat[tab].slice(-199), c] },
        // Gelembung di atas kepala hanya untuk chat area (yang memang terdengar di sekitar).
        bubbles: tab === "area" ? { ...s.bubbles, [c.id]: { text: c.text, ts: c.ts } } : s.bubbles,
      }));
      if (!mine) {
        addUnread(tab);
        if (mentionsMe(c.text)) notify("mention", `${c.name} menyebutmu`, c.text);
        else if (!isViewing(tab)) notify("message", tab === "umum" ? `${c.name} · Umum` : `${c.name} · ${c.scope}`, c.text, { quiet: true });
      }
      break;
    }
    case "dm": {
      const m: DmMessage = msg.msg;
      const selfId = useNet.getState().selfId;
      const other = m.from === selfId ? m.to : m.from;
      useNet.setState((s) => ({
        dms: { ...s.dms, [other]: [...(s.dms[other] ?? []), m].slice(-200) },
        openDms: s.openDms.includes(other) ? s.openDms : [...s.openDms, other],
      }));
      if (m.from !== selfId) {
        addUnread(`dm:${other}`);
        if (!isViewing(`dm:${other}`)) notify("message", `Pesan dari ${m.name}`, m.text);
      }
      break;
    }
    case "dm_history":
      useNet.setState((s) => ({ dms: { ...s.dms, [msg.with]: msg.messages } }));
      break;
    case "summon":
      useNet.setState({ summon: { from: msg.from, name: msg.name, place: msg.place, p: msg.p, ts: Date.now() } });
      notify("summon", `${msg.name} memanggilmu`, msg.place ? `Ke ${msg.place}` : "Ke tempatnya sekarang");
      break;
    case "world":
      useNet.setState({ desks: msg.desks, doors: msg.doors });
      break;
    case "knock":
      showNotice(`🚪 ${msg.name} mengetuk pintu — buka kunci dari dalam kalau boleh masuk`);
      notify("knock", "Ada yang mengetuk pintu", `${msg.name} ingin masuk`);
      break;
    case "mute_request":
      import("./media").then((m) => m.muteMic());
      showNotice(`🔇 ${msg.by} mematikan mic semua orang di ruangan`);
      break;
    case "wb_state":
    case "wb_stroke":
    case "wb_clear":
      import("./whiteboard").then((w) => w.onWhiteboardMessage(msg));
      break;
    case "media":
      useNet.setState({ media: { url: msg.url, token: msg.token } });
      break;
    case "admin_state":
      useNet.setState({ admin: { users: msg.users, registration: msg.registration, inviteCode: msg.inviteCode } });
      break;
    case "settings_ok": {
      const me: Me = { ...msg.user, avatar: msg.user.avatar ? sanitizeAvatar(msg.user.avatar) : null };
      useNet.setState((s) => ({ me, self: s.self && { ...s.self, name: me.name } }));
      break;
    }
    case "notice":
      showNotice(msg.text);
      break;
    case "full":
      stopped = true;
      useNet.setState({ phase: "kicked", kickedReason: "Kantor sedang penuh, coba lagi nanti." });
      break;
  }
}

// ---------- kirim ----------

export function sendMove(p: Vec3, r: number, a: number) {
  send({ t: "move", p, r, a });
}

export function sendAvatar(avatar: AvatarConfig) {
  useNet.setState((s) => ({ self: s.self && { ...s.self, avatar }, me: s.me && { ...s.me, avatar } }));
  send({ t: "avatar", avatar });
}

export function sendSettings(settings: { name?: string; ical?: string }) {
  send({ t: "settings", ...settings });
}

export function sendDesk(action: "claim" | "release" | "lock" | "unlock", id?: string) {
  send({ t: "desk", action, id });
}

export type DoorAction = "open" | "close" | "lock" | "unlock" | "knock";

export function sendDoor(id: string, action: DoorAction) {
  send({ t: "door", id, action });
  if (action === "knock") showNotice("🚪 Kamu mengetuk pintu…");
}

/** Aksi tombol F di pintu: ketuk bila terkunci & kita di luar, selain itu buka/tutup. */
export function doorPrimaryAction(id: string, inside: boolean): DoorAction {
  const d = useNet.getState().doors[id] ?? { open: true, locked: false };
  if (d.locked && !inside) return "knock";
  return d.open ? "close" : "open";
}

export function sendChat(channel: "area" | "umum", text: string) {
  send({ t: "chat", channel, text });
}

export function sendDm(to: string, text: string) {
  send({ t: "dm", to, text });
}

export function openChatTab(tab: ChatTab) {
  useNet.setState((s) => {
    const unread = { ...s.unread };
    delete unread[tab];
    const id = tab.startsWith("dm:") ? tab.slice(3) : null;
    return {
      chatTab: tab,
      chatOpen: true,
      unread,
      openDms: id && !s.openDms.includes(id) ? [...s.openDms, id] : s.openDms,
    };
  });
  if (tab.startsWith("dm:")) send({ t: "dm_history", with: tab.slice(3) });
}

export function closeDm(id: string) {
  useNet.setState((s) => ({ openDms: s.openDms.filter((x) => x !== id), chatTab: s.chatTab === `dm:${id}` ? "area" : s.chatTab }));
}

let idle = false;
export function sendStatus(patch: { manual?: "available" | "busy" | "away"; idle?: boolean } = {}) {
  if (patch.manual) useNet.setState({ manualStatus: patch.manual });
  if (patch.idle !== undefined) idle = patch.idle;
  send({ t: "status", manual: useNet.getState().manualStatus, idle });
}

export const sendSummon = (to: string) => send({ t: "summon", to });
export const sendHand = (up: boolean) => send({ t: "hand", up });
export const sendMuteRoom = () => send({ t: "mute_room" });
export const sendWhiteboard = (msg: Record<string, unknown>) => send(msg);
export const sendLayout = (layout: Layout) => send({ t: "layout", layout });
export const resetLayout = () => send({ t: "layout", reset: true });
export const sendAdmin = (msg: Record<string, unknown>) => send({ t: "admin", ...msg });

// Jaringan kembali → langsung coba sambung ulang tanpa menunggu backoff.
window.addEventListener("online", () => {
  if (useNet.getState().phase === "reconnecting") {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    retry = 0;
    resume();
  }
});
