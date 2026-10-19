// Tabrakan 2D: avatar = lingkaran, penghalang = kotak sejajar sumbu (dinding luar, dinding kaca,
// daun pintu tertutup, furnitur padat — ukuran sama dengan collider 3D).
import { WORLD, toWorld, type Derived, type Floor } from "../../shared/layout";
import { COLLIDERS } from "../../shared/furniture";
import type { Motion, Vec3 } from "./controller";

export interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export const RADIUS = 0.3;
const GLASS = 0.05; // setengah tebal dinding kaca / daun pintu
const OUTER = 0.15; // setengah tebal dinding luar
const CELL = 2;
const MAX_STEP = 0.2;
const MAX_DT = 0.1;

const seg = (orient: "x" | "z", a: [number, number], c: number): Box =>
  orient === "x" ? { x0: a[0], x1: a[1], z0: c - GLASS, z1: c + GLASS } : { x0: c - GLASS, x1: c + GLASS, z0: a[0], z1: a[1] };

export function buildObstacles(floor: Floor, d: Derived, doors: Record<string, { open: boolean }>): Box[] {
  const { minX, maxX, minZ, maxZ } = WORLD;
  const boxes: Box[] = [
    { x0: minX - 1, x1: minX + OUTER, z0: minZ - 1, z1: maxZ + 1 },
    { x0: maxX - OUTER, x1: maxX + 1, z0: minZ - 1, z1: maxZ + 1 },
    { x0: minX - 1, x1: maxX + 1, z0: minZ - 1, z1: minZ + OUTER },
    { x0: minX - 1, x1: maxX + 1, z0: maxZ - OUTER, z1: maxZ + 1 },
  ];
  for (const w of d.walls) boxes.push(seg(w.orient, w.a, w.c));
  for (const dr of d.doors) if (doors[dr.id] && !doors[dr.id].open) boxes.push(seg(dr.orient, dr.a, dr.c));
  for (const it of floor.items) {
    const col = COLLIDERS[it.type];
    if (!col) continue;
    const [hx, , hz] = col.half;
    const [px, , pz] = col.pos;
    const a = toWorld(it, px - hx, pz - hz);
    const b = toWorld(it, px + hx, pz + hz);
    boxes.push({ x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) });
  }
  return boxes;
}

/** Grid sederhana supaya tiap langkah hanya memeriksa penghalang di sekitar avatar. */
export class Grid {
  private cells = new Map<string, Box[]>();
  constructor(boxes: Box[]) {
    for (const b of boxes)
      for (let i = Math.floor(b.x0 / CELL); i <= Math.floor(b.x1 / CELL); i++)
        for (let j = Math.floor(b.z0 / CELL); j <= Math.floor(b.z1 / CELL); j++) {
          const k = `${i},${j}`;
          const list = this.cells.get(k);
          if (list) list.push(b);
          else this.cells.set(k, [b]);
        }
  }
  query(x0: number, z0: number, x1: number, z1: number): Box[] {
    const out = new Set<Box>();
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++)
      for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) for (const b of this.cells.get(`${i},${j}`) ?? []) out.add(b);
    return [...out];
  }
}

/** Jarak kuadrat pusat avatar ke titik terdekat kotak (0 bila pusat di dalam kotak). */
const dist2 = (b: Box, x: number, z: number) => {
  const cx = Math.max(b.x0, Math.min(b.x1, x));
  const cz = Math.max(b.z0, Math.min(b.z1, z));
  return (x - cx) ** 2 + (z - cz) ** 2;
};

/**
 * Langkah dari (ox,oz) ke (nx,nz) terhalang? Penghalang yang sudah ditempati sejak awal (teleport, berdiri, pintu
 * ditutup) boleh ditinggalkan, tapi tidak boleh makin dalam — supaya tidak bisa menembus dinding / pintu terkunci.
 */
function blocked(grid: Grid, ox: number, oz: number, nx: number, nz: number) {
  for (const b of grid.query(nx - RADIUS, nz - RADIUS, nx + RADIUS, nz + RADIUS)) {
    const after = dist2(b, nx, nz);
    if (after >= RADIUS * RADIUS) continue;
    const before = dist2(b, ox, oz);
    if (before >= RADIUS * RADIUS || after < before) return true;
  }
  return false;
}

/** Bagian terjauh (0..1) dari langkah satu sumbu yang tidak tertahan — supaya avatar merapat ke dinding, bukan berhenti sebelum langkah penuh. */
function reach(grid: Grid, x: number, z: number, dx: number, dz: number) {
  if (!blocked(grid, x, z, x + dx, z + dz)) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    if (blocked(grid, x, z, x + dx * mid, z + dz * mid)) hi = mid;
    else lo = mid;
  }
  return lo;
}

/** Gerak dengan tabrakan, per sumbu (x lalu z) supaya avatar meluncur menyusuri dinding. */
export function slide(grid: Grid, x: number, z: number, dx: number, dz: number): [number, number] {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_STEP));
  for (let i = 0; i < steps; i++) {
    x += (dx / steps) * reach(grid, x, z, dx / steps, 0);
    z += (dz / steps) * reach(grid, x, z, 0, dz / steps);
  }
  return [x, z];
}

/** Mesin gerak 2D untuk controller. */
export function createMotion2D(getGrid: () => Grid, start: [number, number]): Motion & { integrate(dt: number): void } {
  let x = start[0];
  let z = start[1];
  let vx = 0;
  let vz = 0;
  let enabled = true;
  return {
    position: (): Vec3 => [x, 0, z],
    setVelocity(a, b) {
      vx = a;
      vz = b;
    },
    teleport(nx, nz) {
      x = nx;
      z = nz;
    },
    setEnabled(on) {
      enabled = on;
    },
    integrate(dt) {
      if (!enabled) return;
      const t = Math.min(dt, MAX_DT);
      [x, z] = slide(getGrid(), x, z, vx * t, vz * t);
    },
  };
}
