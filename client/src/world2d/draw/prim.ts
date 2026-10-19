// Helper gambar dalam satuan meter.

/** Font teks di kanvas — sama dengan UI (Nunito, dibundel lewat @fontsource). */
export const FONT = `"Nunito Variable", system-ui, sans-serif`;
export function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, r = 0) {
  g.fillStyle = col;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}
export function circ(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  g.fillStyle = col;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}
/** Bayangan lembut di bawah bentuk (blur dalam piksel layar, jadi dibagi skala transform). */
export function shadowed(g: CanvasRenderingContext2D, fn: () => void) {
  g.save();
  const m = g.getTransform?.();
  const s = (m && Math.hypot(m.a, m.b)) || 48; // skala piksel/meter, sama untuk semua rotasi
  g.shadowColor = "rgba(0,0,0,.2)";
  g.shadowBlur = 0.12 * s;
  g.shadowOffsetY = 0.06 * s;
  fn();
  g.restore();
}
export function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export type GlyphKind = "lock" | "chair" | "calendar";

/** Ikon kecil (pengganti emoji) di kanvas, berpusat di (x, y), tinggi ±s meter. */
export function glyph(g: CanvasRenderingContext2D, kind: GlyphKind, x: number, y: number, s: number, col: string) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = col;
  g.strokeStyle = col;
  g.lineWidth = 0.14;
  if (kind === "lock") {
    g.beginPath();
    g.arc(0, -0.12, 0.22, Math.PI, 0); // lengkung gembok
    g.stroke();
    g.beginPath();
    g.roundRect(-0.34, -0.12, 0.68, 0.56, 0.1);
    g.fill();
  } else if (kind === "chair") {
    g.beginPath();
    g.roundRect(-0.3, -0.45, 0.6, 0.42, 0.1); // sandaran
    g.roundRect(-0.36, 0.0, 0.72, 0.2, 0.08); // dudukan
    g.fill();
    g.fillRect(-0.3, 0.18, 0.1, 0.3);
    g.fillRect(0.2, 0.18, 0.1, 0.3);
  } else {
    g.beginPath();
    g.roundRect(-0.4, -0.32, 0.8, 0.74, 0.1);
    g.stroke();
    g.fillRect(-0.4, -0.32, 0.8, 0.2); // kepala kalender
    g.fillRect(-0.24, -0.45, 0.08, 0.2);
    g.fillRect(0.16, -0.45, 0.08, 0.2);
  }
  g.restore();
}
