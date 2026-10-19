// Pemilihan isi layar presentasi (tanpa Three.js) — dipakai layar 3D & 2D.
import { useEffect, useMemo, useState } from "react";
import type { Track } from "livekit-client";
import { useMedia } from "./media";
import { remoteState, sameFloor, useNet } from "./net";
import { zoneAt } from "./zones";
import { t } from "./i18n";

/** Track share screen yang tampil di layar zona ini: dari orang yang sedang berada di zona itu (atau diri sendiri). */
export function useScreenTrack(zone: string | null): Track | null {
  const myZone = useNet((s) => s.zoneId);
  const selfId = useNet((s) => s.selfId);
  const screens = useMedia((s) => s.screens);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000); // posisi orang berubah → evaluasi ulang tiap detik
    return () => clearInterval(t);
  }, []);
  return useMemo(() => {
    if (!zone) return null;
    for (const [id, tr] of Object.entries(screens)) {
      if (!tr) continue;
      if (id === selfId) {
        if (myZone === zone) return tr;
        continue;
      }
      const s = remoteState.get(id);
      if (s && sameFloor(id) && zoneAt(s.p[0], s.p[2])?.id === zone) return tr;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screens, selfId, myZone, zone, tick]);
}

/** Kartu pengganti untuk website yang dipasang di layar (iframe tidak bisa digambar ke kanvas). */
export function websiteCanvas(url: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 1280, 720);
  g.addColorStop(0, "#1e2433");
  g.addColorStop(1, "#2c3550");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1280, 720);
  let host = url;
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname;
    path = (u.pathname + u.search).slice(0, 60);
  } catch {
    /* biarkan apa adanya */
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 72px "Nunito Variable", system-ui, sans-serif`;
  ctx.fillText(host, 640, 330);
  ctx.fillStyle = "#aab4cc";
  ctx.font = `34px "Nunito Variable", system-ui, sans-serif`;
  ctx.fillText(path, 640, 395);
  ctx.fillText(t("Buka lewat tombol Layar untuk melihat & berinteraksi"), 640, 560);
  return canvas;
}
