import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { Avatar } from "./Avatar";
import { remoteState, type PlayerInfo } from "./net";

// Ditampilkan sedikit "di masa lalu" lalu diinterpolasi di antara dua posisi yang sudah diterima,
// sehingga gerak tetap mulus walau paket datang 15x/detik dengan jeda tidak rata.
const INTERP_DELAY = 120; // ms

const lerpAngle = (a: number, b: number, k: number) => {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
};

export function RemotePlayer({ info }: { info: PlayerInfo }) {
  const group = useRef<Group>(null);
  const inner = useRef<Group>(null);

  useFrame(() => {
    const g = group.current;
    const s = remoteState.get(info.id);
    if (!g || !inner.current || !s) return;
    const buf = s.buf;
    if (!buf.length) return;

    const rt = performance.now() - INTERP_DELAY;
    let i = buf.length - 1;
    while (i > 0 && buf[i].t > rt) i--;
    const a = buf[i];
    const b = buf[i + 1];
    if (b && rt >= a.t) {
      const k = Math.min(1, (rt - a.t) / Math.max(1, b.t - a.t));
      g.position.set(a.p[0] + (b.p[0] - a.p[0]) * k, a.p[1] + (b.p[1] - a.p[1]) * k, a.p[2] + (b.p[2] - a.p[2]) * k);
      inner.current.rotation.y = lerpAngle(a.r, b.r, k);
    } else {
      // Belum ada data sebelum rt (baru muncul) atau sudah melewati data terakhir (berhenti): tahan di titik itu.
      const at = rt < a.t ? a : buf[buf.length - 1];
      g.position.set(at.p[0], at.p[1], at.p[2]);
      inner.current.rotation.y = at.r;
    }
  });

  return (
    <group ref={group}>
      <group ref={inner}>
        <Avatar id={info.id} name={info.name} avatar={info.avatar} getAnim={() => remoteState.get(info.id)?.a ?? 0} />
      </group>
    </group>
  );
}
