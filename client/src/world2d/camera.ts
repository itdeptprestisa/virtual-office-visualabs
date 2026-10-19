// Kamera 2D: pusat (x,z) dunia, zoom, ukuran kanvas (px CSS). Sumbu y layar = z dunia.
import { WORLD } from "../../../shared/layout";

export interface Cam {
  x: number;
  z: number;
  zoom: number;
  w: number;
  h: number;
}
export const BASE_PX = 48; // piksel per meter pada zoom 1
export const ZOOM_MIN = 0.5; // batas zoom-out bawaan; layar kecil boleh lebih jauh sampai seluruh lantai muat (fitZoom)
export const ZOOM_MAX = 2.5;
const FIT_MARGIN = 1.5; // tepi (m) di sekeliling gedung saat zoom paling jauh
export const WORLD_W = WORLD.maxX - WORLD.minX;
export const WORLD_H = WORLD.maxZ - WORLD.minZ;
export const ppm = (c: Cam) => BASE_PX * c.zoom;
export const toScreen = (c: Cam, x: number, z: number): [number, number] => [(x - c.x) * ppm(c) + c.w / 2, (z - c.z) * ppm(c) + c.h / 2];
export const toWorld2 = (c: Cam, sx: number, sy: number): [number, number] => [(sx - c.w / 2) / ppm(c) + c.x, (sy - c.h / 2) / ppm(c) + c.z];
export function viewRect(c: Cam, margin = 0) {
  const hw = c.w / 2 / ppm(c) + margin;
  const hh = c.h / 2 / ppm(c) + margin;
  return { x0: c.x - hw, z0: c.z - hh, x1: c.x + hw, z1: c.z + hh };
}
/** Zoom yang memuat seluruh lantai (plus sedikit tepi) di kanvas ini. */
export function fitZoom(c: Cam) {
  if (c.w <= 1 || c.h <= 1) return ZOOM_MIN;
  return Math.min(c.w / (WORLD_W + 2 * FIT_MARGIN), c.h / (WORLD_H + 2 * FIT_MARGIN)) / BASE_PX;
}
/** Zoom-out terjauh: bawaan ZOOM_MIN, atau lebih jauh lagi bila perlu supaya seluruh lantai bisa terlihat. */
export const minZoom = (c: Cam) => Math.min(ZOOM_MIN, fitZoom(c));
export const clampZoom = (c: Cam, zoom: number) => Math.min(ZOOM_MAX, Math.max(minZoom(c), zoom));

/** Zoom baru dari cubitan dua jari: sebanding perubahan jarak jari sejak cubitan dimulai. */
export function pinchZoom(startZoom: number, startDist: number, dist: number, min = ZOOM_MIN) {
  if (startDist <= 0) return startZoom;
  return Math.min(ZOOM_MAX, Math.max(min, (startZoom * dist) / startDist));
}
