// Lapisan dinamis per frame, digambar di atas lapisan diam dengan transform meter → layar.
import { PROXIMITY, angleOf, type Derived, type Floor, type Zone } from "../../../shared/layout";
import type { DeskState } from "../net";
import type { AvatarConfig } from "../avatar/config";
import { drawAvatar } from "./draw/avatar";
import { FONT, glyph, type GlyphKind } from "./draw/prim";
import { DRAW, TALL, drawItem } from "./draw/furniture";
import { FOOTPRINT } from "../../../shared/furniture";
import { ppm, type Cam } from "./camera";

export interface Body2D {
  id: string;
  cfg: AvatarConfig;
  x: number;
  z: number;
  facing: number;
  anim: number;
  hand: boolean;
}

export interface DynFrame {
  floor: Floor;
  derived: Derived;
  zone: Zone | null; // zona aktif diri sendiri
  self: Body2D;
  others: Body2D[];
  ring: { show: boolean; someone: boolean };
  t: number; // detik
  doors: Record<string, { open: boolean; locked: boolean }>;
  doorAnim: Map<string, number>; // 0 = tertutup … 1 = terbuka (dianimasikan)
  desks: Record<string, DeskState>;
  bookings: { room: string; text: string; now: boolean }[];
  screens: Map<string, CanvasImageSource>; // id item layar → sumber gambar (video / kartu website)
  boards: Map<string, HTMLCanvasElement>; // id item whiteboard → kanvas coretan
  lockedText?: string; // label pintu terkunci (sudah diterjemahkan pemanggil)
  editor: { selected: string | null; drag: { id: string; x: number; z: number } | null };
}

/** Label pill (ikon vektor + teks) di atas meja/pintu. */
function pill(g: CanvasRenderingContext2D, x: number, z: number, text: string, bg: string, icon?: { kind: GlyphKind; col: string }) {
  g.font = `700 0.28px ${FONT}`;
  const iw = icon ? 0.34 : 0;
  const w = g.measureText(text).width + 0.3 + iw;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(x - w / 2, z - 0.2, w, 0.4, 0.2);
  g.fill();
  if (icon) glyph(g, icon.kind, x - w / 2 + 0.15 + 0.1, z, 0.26, icon.col);
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, x + iw / 2, z + 0.01);
}

export function drawDynamic(g: CanvasRenderingContext2D, cam: Cam, f: DynFrame) {
  const p = ppm(cam);
  g.save();
  g.setTransform(p * devicePixelRatio, 0, 0, p * devicePixelRatio, (cam.w / 2 - cam.x * p) * devicePixelRatio, (cam.h / 2 - cam.z * p) * devicePixelRatio);
  // sorotan zona aktif
  const zn = f.zone;
  if (zn) {
    g.fillStyle = zn.color + "33";
    g.strokeStyle = zn.color;
    g.lineWidth = 0.06;
    g.beginPath();
    if (zn.shape === "rect") g.rect(zn.x[0], zn.z[0], zn.x[1] - zn.x[0], zn.z[1] - zn.z[0]);
    else g.arc(zn.cx, zn.cz, zn.r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  // daun pintu kaca geser: 0 = tertutup, 1 = terbuka; terkunci = kemerahan
  for (const d of f.derived.doors) {
    const st = f.doors[d.id] ?? { open: true, locked: false };
    const k = f.doorAnim.get(d.id) ?? (st.open ? 1 : 0);
    const half = (d.a[1] - d.a[0]) / 2;
    const slide = half * 0.92 * k;
    g.fillStyle = st.locked ? "#f2a3a6" : "rgba(159,208,245,.9)";
    g.strokeStyle = st.locked ? "#c0392b" : "#5b7fa6";
    g.lineWidth = 0.03;
    for (const sgn of [-1, 1]) {
      const a0 = (d.a[0] + d.a[1]) / 2 + (sgn < 0 ? -half - slide : slide);
      if (d.orient === "x") {
        g.fillRect(a0, d.c - 0.07, half, 0.14);
        g.strokeRect(a0, d.c - 0.07, half, 0.14);
      } else {
        g.fillRect(d.c - 0.07, a0, 0.14, half);
        g.strokeRect(d.c - 0.07, a0, 0.14, half);
      }
    }
  }
  // meja: pembatas merah saat mode fokus + label pemilik
  for (const zn of f.derived.zones) {
    const dk = f.desks[zn.id];
    if (!dk || zn.shape !== "rect") continue;
    if (dk.locked) {
      g.fillStyle = "rgba(229,72,77,.15)";
      g.fillRect(zn.x[0], zn.z[0], zn.x[1] - zn.x[0], zn.z[1] - zn.z[0]);
      g.strokeStyle = "#e5484d";
      g.lineWidth = 0.05;
      g.strokeRect(zn.x[0], zn.z[0], zn.x[1] - zn.x[0], zn.z[1] - zn.z[0]);
    }
    pill(g, (zn.x[0] + zn.x[1]) / 2, zn.z[0] - 0.15, dk.ownerName, dk.locked ? "#e5484d" : dk.online ? "rgba(30,32,40,.78)" : "rgba(30,32,40,.45)", dk.locked ? { kind: "lock", col: "#fff" } : { kind: "chair", col: "#f2a26b" });
  }
  // label pintu: terkunci (seperti 3D) + booking ruangan, digabung jadi satu pill
  for (const d of f.derived.doors) {
    const locked = f.doors[d.id]?.locked;
    const b = f.bookings.find((x) => x.room === d.id);
    if (!locked && !b) continue;
    const mid = (d.a[0] + d.a[1]) / 2;
    // di sisi luar pintu (lorong), tempat orang yang mendekat melihatnya — tidak menimpa tulisan nama di lantai
    const zn = f.derived.zones.find((z) => z.id === d.room);
    const inside = zn?.shape === "rect" ? (d.orient === "x" ? (zn.z[0] + zn.z[1]) / 2 : (zn.x[0] + zn.x[1]) / 2) : d.c - 1;
    const out = d.c >= inside ? 1 : -1;
    const [x, z] = d.orient === "x" ? [mid, d.c + out * 0.35] : [d.c + out * 1.2, mid];
    const text = [locked ? (f.lockedText ?? "") : "", b?.text ?? ""].filter(Boolean).join(" · ");
    pill(g, x, z, text, locked ? "#e5484d" : b!.now ? "#c0392b" : "rgba(30,32,40,.78)", locked ? { kind: "lock", col: "#fff" } : { kind: "calendar", col: b!.now ? "#fff" : "#8fb4ff" });
  }
  // isi layar presentasi & whiteboard
  for (const it of f.floor.items) {
    if ((it.type !== "screen" && it.type !== "whiteboard") || it.id === f.editor.drag?.id) continue;
    g.save();
    g.translate(it.x, it.z);
    g.rotate(-angleOf(it.rot));
    DRAW[it.type](g, it);
    const src = it.type === "screen" ? f.screens.get(it.id) : f.boards.get(it.id);
    const [w, h] = it.type === "screen" ? [4.8, 2.7] : [2.6, 1.4];
    if (src) g.drawImage(src, -w / 2, 0.12, w, h * 0.35); // layar dinding dilihat dari atas: tampil sebagai strip
    g.restore();
  }
  // editor denah: item yang sedang diseret (dilewati lapisan diam) + cincin item terpilih
  const { selected, drag } = f.editor;
  if (drag) {
    const it = f.floor.items.find((i) => i.id === drag.id);
    if (it) drawItem(g, { ...it, x: drag.x, z: drag.z });
  }
  if (selected) {
    const it = f.floor.items.find((i) => i.id === selected);
    if (it) {
      const [x, z] = drag?.id === it.id ? [drag.x, drag.z] : [it.x, it.z];
      g.strokeStyle = "#2f80ed";
      g.lineWidth = 0.08;
      g.beginPath();
      g.arc(x, z, FOOTPRINT[it.type], 0, Math.PI * 2);
      g.stroke();
    }
  }
  // lingkaran jarak dengar
  if (f.ring.show) {
    const col = f.ring.someone ? "#4caf72" : "#5b8def";
    g.fillStyle = col + (f.ring.someone ? "1a" : "0d");
    g.strokeStyle = col;
    g.lineWidth = 0.06;
    g.beginPath();
    g.arc(f.self.x, f.self.z, PROXIMITY.hear, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  // avatar, urut dari utara ke selatan supaya yang di depan menutupi
  const bodies = [...f.others, f.self].sort((a, b) => a.z - b.z);
  for (const b of bodies) drawAvatar(g, b.cfg, b.x, b.z, b.facing, b.anim, f.t, b.hand);
  // item tinggi (tanaman, rak, kulkas, …) menutupi avatar yang berdiri tepat di belakangnya
  for (const it of f.floor.items) {
    if (!TALL.has(it.type)) continue;
    if (!bodies.some((b) => Math.abs(b.x - it.x) < FOOTPRINT[it.type] && b.z < it.z && it.z - b.z < 0.8)) continue;
    drawItem(g, it);
  }
  g.restore();
}
