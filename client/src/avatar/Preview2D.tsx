import { useEffect, useRef } from "react";
import type { AvatarConfig } from "./config";
import { drawAvatar } from "../world2d/draw/avatar";

/** Pratinjau avatar 2D: berputar pelan melewati 4 arah hadap, dengan animasi yang dipilih. */
export function Preview2D({ config, anim }: { config: AvatarConfig; anim: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext("2d");
    if (!g) return; // kanvas ditolak browser: pratinjau kosong saja
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const r = c.getBoundingClientRect();
      const w = Math.round(r.width * devicePixelRatio);
      const h = Math.round(r.height * devicePixelRatio);
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = "#e9ecef";
      g.fillRect(0, 0, w, h);
      const s = h / 2.1; // piksel per meter: avatar ±1,1 m mengisi ±55% tinggi
      g.setTransform(s, 0, 0, s, w / 2, h * 0.85);
      const facing = [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(now / 1500) % 4];
      drawAvatar(g, config, 0, 0, facing, anim, now / 1000, false);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [config, anim]);
  return <canvas ref={ref} className="avatar-preview2d" style={{ width: "100%", height: "100%", display: "block" }} />;
}
