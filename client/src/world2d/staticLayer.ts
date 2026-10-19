// Lapisan diam: lantai, ruangan, dinding, furnitur & tulisan nama ruangan — digambar ke kanvas offscreen untuk area
// sekitar layar (lihat planLayer: cadangan geser + batas piksel), lalu cukup di-blit tiap frame. Selama zoom berjalan
// lapisan lama diskalakan; digambar ulang tajam setelah zoom berhenti.
import { WORLD, inZone, type Derived, type Floor, type Room } from "../../../shared/layout";
import { PAL } from "./palette";
import { drawItem } from "./draw/furniture";
import { FONT } from "./draw/prim";
import { ppm, viewRect, type Cam } from "./camera";
import { planLayer, shouldRedraw } from "./layerPlan";
import { place } from "../i18n";

export interface SceneData {
  floor: Floor;
  derived: Derived;
  skip?: string | null; // item yang sedang diseret editor (digambar di lapisan dinamis)
}

const DYNAMIC_ITEMS = new Set(["screen", "whiteboard"]); // isinya berubah: digambar per frame

const tint = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const m = (v: number) => Math.round(v + (255 - v) * k);
  return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`;
};

function grid(g: CanvasRenderingContext2D, x0: number, z0: number, x1: number, z1: number, step: number, col: string, lw: number) {
  g.strokeStyle = col;
  g.lineWidth = lw;
  g.beginPath();
  for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
    g.moveTo(x, z0);
    g.lineTo(x, z1);
  }
  for (let z = Math.ceil(z0 / step) * step; z <= z1; z += step) {
    g.moveTo(x0, z);
    g.lineTo(x1, z);
  }
  g.stroke();
}

function nameText(g: CanvasRenderingContext2D, room: Room, label: string) {
  const { side, center } = room.door;
  const w = room.x[1] - room.x[0];
  const fh = Math.min(1.6, Math.max(0.5, w / 12));
  const inward = side === "s" ? -1 : side === "n" ? 1 : 0;
  const across = side === "n" ? room.z[0] : side === "s" ? room.z[1] : (room.z[0] + room.z[1]) / 2;
  const x = side === "e" ? room.x[1] - 1.2 : side === "w" ? room.x[0] + 1.2 : center;
  g.font = `800 ${fh}px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = tint(room.color, -0.3).replace("rgb", "rgba").replace(")", ",.85)");
  g.fillText(label, x, across + inward * (0.45 + fh / 2), w - 1);
}

export class StaticLayer {
  private canvas = document.createElement("canvas");
  private rect = { x0: 0, z0: 0, x1: 0, z1: 0 };
  private scale = 0;
  private key: unknown = null;
  private dirty = true;
  private wanted = 0; // skala yang diminta kamera terakhir kali
  private wantedAt = 0; // kapan skala itu mulai diminta (ms)

  invalidate() {
    this.dirty = true;
  }

  draw(g: CanvasRenderingContext2D, cam: Cam, scene: SceneData) {
    const plan = planLayer(cam, devicePixelRatio);
    const now = performance.now();
    if (Math.abs(plan.scale - this.wanted) > 1e-6) {
      this.wanted = plan.scale;
      this.wantedAt = now;
    }
    const v = viewRect(cam);
    const inside = v.x0 >= this.rect.x0 && v.z0 >= this.rect.z0 && v.x1 <= this.rect.x1 && v.z1 <= this.rect.z1;
    const key = [scene.floor, scene.derived, scene.skip];
    const redraw = shouldRedraw({
      dirty: this.dirty,
      inside,
      keyChanged: key.some((k, i) => k !== (this.key as unknown[] | null)?.[i]),
      scaleChanged: Math.abs(plan.scale - this.scale) > 1e-6,
      sinceScaleChange: now - this.wantedAt,
    });
    if (redraw) {
      this.render(scene, plan.rect, plan.scale);
      this.key = key;
      this.dirty = false;
    }
    const r = this.rect;
    const p = ppm(cam);
    g.drawImage(this.canvas, (r.x0 - cam.x) * p + cam.w / 2, (r.z0 - cam.z) * p + cam.h / 2, (r.x1 - r.x0) * p, (r.z1 - r.z0) * p);
  }

  private render(scene: SceneData, r: { x0: number; z0: number; x1: number; z1: number }, s: number) {
    this.rect = r;
    this.scale = s;
    const c = this.canvas;
    c.width = Math.ceil((r.x1 - r.x0) * s);
    c.height = Math.ceil((r.z1 - r.z0) * s);
    const g = c.getContext("2d")!;
    g.setTransform(s, 0, 0, s, -r.x0 * s, -r.z0 * s);
    const { floor, derived } = scene;
    const { minX, maxX, minZ, maxZ } = WORLD;
    // luar gedung + lantai kayu
    g.fillStyle = PAL.bg;
    g.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0);
    g.fillStyle = PAL.floor;
    g.fillRect(minX, minZ, maxX - minX, maxZ - minZ);
    grid(g, minX, minZ, maxX, maxZ, 1, PAL.floorLine, 0.02);
    // lantai ruangan: divisi/area bersuara "near" = karpet; ruangan lain = warna ruangan dipudarkan
    // ruangan bersarang (manager/rapat di dalam divisi) digambar setelah induknya: urut dari yang terluas
    const rooms = [...floor.rooms].sort((a, b) => (b.x[1] - b.x[0]) * (b.z[1] - b.z[0]) - (a.x[1] - a.x[0]) * (a.z[1] - a.z[0]));
    for (const rm of rooms) {
      const carpet = rm.audio === "near";
      g.fillStyle = carpet ? PAL.carpet : tint(rm.color, 0.82);
      g.fillRect(rm.x[0], rm.z[0], rm.x[1] - rm.x[0], rm.z[1] - rm.z[0]);
      if (carpet) grid(g, rm.x[0], rm.z[0], rm.x[1], rm.z[1], 0.5, PAL.carpetLine, 0.015);
    }
    // area (pantry, lounge, panggung): warna lembut
    for (const zn of derived.zones) {
      if (zn.kind !== "area") continue;
      g.fillStyle = tint(zn.color, 0.85);
      g.beginPath();
      if (zn.shape === "rect") g.rect(zn.x[0], zn.z[0], zn.x[1] - zn.x[0], zn.z[1] - zn.z[0]);
      else g.arc(zn.cx, zn.cz, zn.r, 0, Math.PI * 2);
      g.fill();
    }
    // penanda meja (garis putus tipis)
    g.setLineDash([0.18, 0.12]);
    g.lineWidth = 0.02;
    for (const zn of derived.zones) {
      if (zn.kind !== "desk" || zn.shape !== "rect") continue;
      g.strokeStyle = "rgba(224,164,88,.6)";
      g.strokeRect(zn.x[0], zn.z[0], zn.x[1] - zn.x[0], zn.z[1] - zn.z[0]);
    }
    g.setLineDash([]);
    // tulisan nama di lantai
    for (const rm of floor.rooms) nameText(g, rm, place(rm.name));
    // furnitur (kecuali yang isinya dinamis / sedang diseret)
    for (const it of floor.items) if (!DYNAMIC_ITEMS.has(it.type) && it.id !== scene.skip && inZone({ shape: "rect", x: [r.x0 - 4, r.x1 + 4], z: [r.z0 - 4, r.z1 + 4] } as never, it.x, it.z)) drawItem(g, it);
    // dinding kaca + tiang
    for (const w of derived.walls) {
      g.fillStyle = PAL.glass;
      if (w.orient === "x") g.fillRect(w.a[0], w.c - 0.05, w.a[1] - w.a[0], 0.1);
      else g.fillRect(w.c - 0.05, w.a[0], 0.1, w.a[1] - w.a[0]);
      g.fillStyle = PAL.frame;
      for (const a of w.a) {
        if (w.orient === "x") g.fillRect(a - 0.05, w.c - 0.08, 0.1, 0.16);
        else g.fillRect(w.c - 0.08, a - 0.05, 0.16, 0.1);
      }
    }
    // dinding luar tebal: atas + muka depan (sisi utara terlihat dari kamera atas-miring)
    g.fillStyle = PAL.wallTop;
    g.fillRect(minX - 0.15, minZ - 0.3, maxX - minX + 0.3, 0.3);
    g.fillRect(minX - 0.3, minZ - 0.3, 0.3, maxZ - minZ + 0.6);
    g.fillRect(maxX, minZ - 0.3, 0.3, maxZ - minZ + 0.6);
    g.fillRect(minX - 0.3, maxZ, maxX - minX + 0.6, 0.3);
    g.fillStyle = PAL.wallFace;
    g.fillRect(minX, minZ, maxX - minX, 0.45);
    g.fillStyle = PAL.wallEdge;
    g.fillRect(minX, minZ + 0.43, maxX - minX, 0.04);
  }
}
