// Posisi orang lain ditampilkan sedikit "di masa lalu" lalu diinterpolasi di antara dua posisi yang sudah diterima,
// sehingga gerak tetap mulus walau paket datang 15x/detik dengan jeda tidak rata. Dipakai 3D & 2D.
import { remoteState, type Vec3 } from "./net";

export const INTERP_DELAY = 120; // ms

const lerpAngle = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

export function sampleRemote(id: string, nowMs: number): { p: Vec3; r: number; a: number } | null {
  const s = remoteState.get(id);
  if (!s || !s.buf.length) return null;
  const buf = s.buf;
  const rt = nowMs - INTERP_DELAY;
  let i = buf.length - 1;
  while (i > 0 && buf[i].t > rt) i--;
  const a = buf[i];
  const b = buf[i + 1];
  if (b && rt >= a.t) {
    const k = Math.min(1, (rt - a.t) / Math.max(1, b.t - a.t));
    return { p: [a.p[0] + (b.p[0] - a.p[0]) * k, a.p[1] + (b.p[1] - a.p[1]) * k, a.p[2] + (b.p[2] - a.p[2]) * k], r: lerpAngle(a.r, b.r, k), a: s.a };
  }
  // Belum ada data sebelum rt (baru muncul) atau sudah melewati data terakhir (berhenti): tahan di titik itu.
  const at = rt < a.t ? a : buf[buf.length - 1];
  return { p: [at.p[0], at.p[1], at.p[2]], r: at.r, a: s.a };
}
