import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Layout } from "../../shared/layout.js";
import type { Avatar } from "./avatar.js";

// Penyimpanan sederhana berbasis file JSON (cukup untuk puluhan user, tanpa dependency native).
// Ditulis ke file sementara lalu di-rename, supaya file tidak rusak bila proses mati di tengah penulisan.

export type Role = "admin" | "member" | "guest";

export interface User {
  id: string;
  username: string;
  name: string;
  passHash: string;
  salt: string;
  role: Role;
  disabled: boolean;
  avatar: Avatar | null;
  ical: string | null;
  createdAt: number;
  lastPos: [number, number, number] | null;
  lastFloor?: string;
  guestExp?: number; // akun tamu: dihapus otomatis setelah waktu ini
}

export interface FileRef {
  id: string;
  name: string;
  mime: string;
  size: number;
}

export interface ChatMsg {
  id: string;
  from: string;
  name: string;
  to?: string;
  text: string;
  ts: number;
  file?: FileRef;
  reactions?: Record<string, string[]>; // emoji → id user
}

export interface Booking {
  id: string;
  room: string; // id ruangan
  title: string;
  start: number;
  end: number;
  by: string;
  byName: string;
}

export interface Stroke {
  id: string;
  color: string;
  width: number;
  pts: number[]; // [x0,y0,x1,y1,...] dinormalisasi 0..1
}

interface Data {
  users: User[];
  sessions: Record<string, { userId: string; exp: number }>;
  settings: { registration: "open" | "invite"; inviteCode: string };
  layout: Layout | null;
  deskOwners: Record<string, string>; // id zona meja → id user
  umum: ChatMsg[];
  dms: Record<string, ChatMsg[]>; // "idA|idB" (urut) → pesan
  whiteboards: Record<string, Stroke[]>; // id ruangan → coretan
  files: Record<string, FileRef & { by: string; ts: number }>;
  bookings: Booking[];
  guestLinks: Record<string, { label: string; exp: number; createdBy: string }>;
  screens: Record<string, string>; // id item layar → URL website yang ditampilkan
}

const FILE = resolve(process.env.DATA_FILE ?? "data/db.json");
export const DATA_DIR = dirname(FILE);
export const UPLOAD_DIR = resolve(DATA_DIR, "uploads");
const BACKUP_DIR = resolve(DATA_DIR, "backups");
const BACKUP_KEEP = 20;

function empty(): Data {
  return {
    users: [],
    sessions: {},
    settings: { registration: "open", inviteCode: Math.random().toString(36).slice(2, 10) },
    layout: null,
    deskOwners: {},
    umum: [],
    dms: {},
    whiteboards: {},
    files: {},
    bookings: [],
    guestLinks: {},
    screens: {},
  };
}

function load(): Data {
  if (!existsSync(FILE)) return empty();
  try {
    return { ...empty(), ...JSON.parse(readFileSync(FILE, "utf8")) };
  } catch (err) {
    console.error(`Gagal membaca ${FILE}, mulai dari data kosong:`, err);
    return empty();
  }
}

export const db: Data = load();

let timer: NodeJS.Timeout | null = null;
export function save() {
  if (timer) return;
  timer = setTimeout(flush, 500);
}

export function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  mkdirSync(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(db));
  renameSync(tmp, FILE);
}

/** Salin db.json ke data/backups/ (dipanggil saat start & berkala); simpan BACKUP_KEEP terbaru. */
export function backup() {
  if (!existsSync(FILE)) return;
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  copyFileSync(FILE, resolve(BACKUP_DIR, `db-${stamp}.json`));
  const old = readdirSync(BACKUP_DIR).filter((f) => f.startsWith("db-")).sort().slice(0, -BACKUP_KEEP);
  for (const f of old) rmSync(resolve(BACKUP_DIR, f));
}

export const dmKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function pushCapped<T>(list: T[], item: T, cap: number) {
  list.push(item);
  if (list.length > cap) list.splice(0, list.length - cap);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    flush();
    process.exit(0);
  });
}
