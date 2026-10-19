// Penempatan label HTML (nama, gelembung, video) di atas kepala avatar 2D — tanpa pencarian DOM per frame.

const LABEL_LIFT = 1.35; // label nama di atas kepala (m di atas kaki, pada skala 2D)

interface LabelEl {
  style: { transform: string; visibility: string };
}

/** Letakkan label tiap avatar yang tergambar; label lain (mis. pemain tanpa data posisi) disembunyikan. */
export function placeLabels(els: Map<string, LabelEl>, bodies: { id: string; x: number; z: number; sit: boolean }[], toScreen: (x: number, z: number) => [number, number]) {
  const shown = new Set<string>();
  for (const b of bodies) {
    const el = els.get(b.id);
    if (!el) continue;
    const [sx, sy] = toScreen(b.x, b.z - LABEL_LIFT * (b.sit ? 0.8 : 1));
    el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
    el.style.visibility = "visible";
    shown.add(b.id);
  }
  for (const [id, el] of els) if (!shown.has(id)) el.style.visibility = "hidden";
}
