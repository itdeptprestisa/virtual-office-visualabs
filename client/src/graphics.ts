// Pilihan kualitas grafis (dipakai Scene, kamera Player & HUD).
import { create } from "zustand";

// high = 3D penuh; low = 3D tanpa efek berat; flat = 2.5D ringan (kamera ortografis dari atas miring,
// tanpa bayangan real-time, tanpa efek layar, tanpa pantulan lingkungan).
export type Quality = "high" | "low" | "flat";
const QUALITIES: Quality[] = ["high", "low", "flat"];

// Mode tampilan: 2D (bawaan, ringan) atau 3D.
export type View = "2d" | "3d";
function savedView(): View {
  try {
    return localStorage.getItem("vo-view") === "3d" ? "3d" : "2d";
  } catch {
    return "2d";
  }
}

function savedQuality(): Quality {
  try {
    const q = localStorage.getItem("vo-graphics") as Quality | null;
    return q && QUALITIES.includes(q) ? q : "high";
  } catch {
    return "high";
  }
}

export const useGraphics = create<{ view: View; setView: (v: View) => void; quality: Quality; fps: number; calls: number; tris: number; setQuality: (q: Quality, remember?: boolean) => void }>((set) => ({
  view: savedView(),
  setView: (view) => {
    set({ view });
    try {
      localStorage.setItem("vo-view", view);
    } catch {
      /* mode privat */
    }
  },
  quality: savedQuality(),
  fps: 0,
  calls: 0,
  tris: 0,
  setQuality: (quality, remember = false) => {
    set({ quality });
    if (!remember) return;
    try {
      localStorage.setItem("vo-graphics", quality);
    } catch {
      /* mode privat */
    }
  },
}));
