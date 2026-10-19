import type { AvatarConfig } from "../../avatar/config";
import { ANIM } from "../../anims";
import { circ, rr, shade } from "./prim";

const U = 0.012; // meter per unit gambar (tinggi avatar ±95 unit ≈ 1,1 m)

/** facing = rotation.y three.js: 0 menghadap selatan (+z, ke kamera). */
export function dirOf(facing: number): "d" | "u" | "l" | "r" {
  const a = Math.atan2(Math.sin(facing), Math.cos(facing));
  if (Math.abs(a) <= Math.PI / 4) return "d";
  if (Math.abs(a) >= (3 * Math.PI) / 4) return "u";
  return a > 0 ? "r" : "l";
}

export function drawAvatar(g: CanvasRenderingContext2D, a: AvatarConfig, x: number, z: number, facing: number, anim: number, t: number, hand: boolean) {
  const dir = dirOf(facing);
  const side = dir === "l" || dir === "r";
  const flip = dir === "l" ? -1 : 1;
  const sit = anim === ANIM.sit;
  const moving = anim === ANIM.walk || anim === ANIM.run;
  const step = moving ? Math.sin(t * (anim === ANIM.run ? 16 : 10)) * 6 : 0;
  const bob = anim === ANIM.dance ? Math.abs(Math.sin(t * 8)) * 6 : moving ? Math.abs(step) * 0.3 : 0;
  g.save();
  g.translate(x, z);
  g.scale(U, U);
  g.translate(0, -48 - bob + (sit ? 10 : 0)); // asal di kaki
  // bayangan
  g.fillStyle = "rgba(0,0,0,.18)";
  g.beginPath();
  g.ellipse(0, 48 + bob - (sit ? 10 : 0), 26, 8, 0, 0, Math.PI * 2);
  g.fill();
  // kaki + sepatu
  const legTop = sit ? 26 : 22;
  const legH = sit ? 12 : 22;
  const legs: [number, number][] = side ? [[-5 + step * flip, 0], [3 - step * flip, 0]] : [[-11, step], [3, -step]];
  for (const [lx, dy] of legs) {
    if (a.bottom === "skirt") rr(g, lx, legTop + 8 + dy, 8, legH - 8, a.skin, 3);
    else if (a.bottom === "shorts") {
      rr(g, lx, legTop + dy, 8, 10, a.bottomColor, 3);
      rr(g, lx, legTop + 10 + dy, 8, legH - 10, a.skin, 3);
    } else rr(g, lx, legTop + dy, 8, legH, a.bottomColor, 3);
    rr(g, lx - 1, legTop + legH - 2 + dy, 10, 6, a.shoeColor, 3);
  }
  if (a.bottom === "skirt") {
    g.fillStyle = a.bottomColor;
    g.beginPath();
    g.moveTo(-14, 32);
    g.lineTo(14, 32);
    g.lineTo(17, 22);
    g.lineTo(-17, 22);
    g.closePath();
    g.fill();
  }
  // badan
  const bw = side ? 22 : 30;
  rr(g, -bw / 2, -4, bw, 30, a.topColor, 9);
  if (a.top === "suit" && dir === "d") {
    g.fillStyle = "#f4f4f4";
    g.beginPath();
    g.moveTo(-5, -4);
    g.lineTo(5, -4);
    g.lineTo(0, 10);
    g.fill();
    rr(g, -1.5, 0, 3, 12, "#c0392b", 1);
  }
  if (a.top === "shirt" && dir === "d") {
    g.fillStyle = "#fff";
    g.beginPath();
    g.moveTo(-7, -4);
    g.lineTo(0, 3);
    g.lineTo(7, -4);
    g.fill();
    for (const yy of [6, 12, 18]) circ(g, 0, yy, 1.2, shade(a.topColor, 0.6));
  }
  if (a.top === "hoodie") {
    if (dir === "u") rr(g, -11, -6, 22, 12, shade(a.topColor, 0.82), 6);
    else if (dir === "d") rr(g, -6, 12, 12, 7, shade(a.topColor, 0.85), 3);
  }
  // lengan (wave / tangan diangkat: lengan kanan ke atas)
  const raise = hand || anim === ANIM.wave || anim === ANIM.thumbs;
  const wave = anim === ANIM.wave ? Math.sin(t * 12) * 4 : 0;
  const arms: [number, number][] = side ? [[-3, 0]] : [[-bw / 2 - 6, step], [bw / 2 - 1, -step]];
  arms.forEach(([ax, dy], i) => {
    const up = raise && (side || i === 1);
    if (up) {
      rr(g, ax + wave, -28, 7, 24, shade(a.topColor, 0.9), 4);
      circ(g, ax + 3.5 + wave, -30, 3.6, a.skin);
    } else {
      rr(g, ax, -1 + dy, 7, 22, shade(a.topColor, 0.9), 4);
      circ(g, ax + 3.5, 22 + dy, 3.6, a.skin);
    }
  });
  // kepala
  const hy = -24;
  // Rambut panjang/bob/kuncir bagian belakang: dari depan & samping berada di balik kepala (digambar lebih dulu,
  // membingkai wajah), dari belakang menutupi kepala.
  const longHair = !a.hijab && (a.hair === "long" || a.hair === "bob" || a.hair === "ponytail");
  const backHair = () => rr(g, -23, hy - 6, 46, a.hair === "long" ? 40 : a.hair === "bob" ? 28 : 22, a.hairColor, 12);
  if (longHair && dir !== "u") backHair();
  if (a.hijab) {
    rr(g, -24, hy - 22, 48, 48, a.hijabColor, 22);
    rr(g, -16, -6, 32, 8, a.hijabColor, 4);
    if (dir !== "u") {
      g.fillStyle = a.skin;
      g.beginPath();
      if (side) g.ellipse(6 * flip, hy + 2, 11, 15, 0, 0, Math.PI * 2);
      else g.ellipse(0, hy + 3, 15, 16, 0, 0, Math.PI * 2);
      g.fill();
    }
  } else circ(g, 0, hy, 22, a.skin);
  // rambut
  if (!a.hijab && a.hair !== "none") {
    const hc = a.hairColor;
    if (longHair && dir === "u") backHair();
    if (dir === "u") circ(g, 0, hy, 23, hc);
    else {
      g.fillStyle = hc;
      g.beginPath();
      const s0 = Math.PI * (side ? (flip > 0 ? 0.95 : 1.05) : 1.02);
      const s1 = Math.PI * (side ? (flip > 0 ? 1.95 : 2.05) : 1.98);
      g.arc(side ? -4 * flip : 0, hy - 2, a.hair === "buzz" ? 22.5 : 23, s0, s1);
      g.fill();
      if (a.hair === "spiky")
        for (const sx of [-14, -5, 5, 14]) {
          g.beginPath();
          g.moveTo(sx - 6, hy - 16);
          g.lineTo(sx, hy - 30);
          g.lineTo(sx + 6, hy - 16);
          g.fill();
        }
      if (a.hair === "curly") for (const [sx, sy] of [[-16, -12], [-6, -20], [6, -20], [16, -12], [-20, -2], [20, -2]]) circ(g, sx, hy + sy, 8, hc);
      if (!side && a.hair !== "buzz") rr(g, -20, hy - 16, 40, 8, hc, 4);
    }
    if (a.hair === "ponytail" && dir !== "d") circ(g, side ? -18 * flip : 0, hy + (side ? 4 : 10), 9, hc);
    if (a.hair === "bun") circ(g, 0, hy - 24, 10, hc);
  }
  // wajah
  if (dir !== "u") {
    const ex = side ? [8 * flip] : [-8, 8];
    for (const e of ex) circ(g, e, hy + 2, 2.6, "#2b2b2b");
    g.fillStyle = "rgba(255,120,120,.35)";
    for (const e of ex) {
      g.beginPath();
      g.arc(e + (side ? 2 * flip : e > 0 ? 3 : -3), hy + 9, 3.5, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = "#7a3b2e";
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(side ? 9 * flip : 0, hy + 9, 3.5, 0.2, Math.PI - 0.2);
    g.stroke();
    if (a.glasses !== "none") {
      g.strokeStyle = "#222";
      g.lineWidth = 1.8;
      for (const e of ex) {
        g.beginPath();
        if (a.glasses === "round") g.arc(e, hy + 2, 6, 0, Math.PI * 2);
        else g.rect(e - 6, hy - 3, 12, 9);
        g.stroke();
      }
    }
  }
  // topi
  if (a.hat === "cap") {
    g.fillStyle = a.topColor;
    g.beginPath();
    g.arc(0, hy - 6, 23, Math.PI, 0);
    g.fill();
    if (dir !== "u") rr(g, side ? (flip > 0 ? 6 : -30) : -16, hy - 8, side ? 24 : 32, 6, shade(a.topColor, 0.8), 3);
  }
  if (a.hat === "beanie") {
    g.fillStyle = a.bottomColor;
    g.beginPath();
    g.arc(0, hy - 6, 24, Math.PI, 0);
    g.fill();
    rr(g, -24, hy - 10, 48, 7, shade(a.bottomColor, 0.8), 3);
    circ(g, 0, hy - 32, 5, shade(a.bottomColor, 1.2));
  }
  g.restore();
}
