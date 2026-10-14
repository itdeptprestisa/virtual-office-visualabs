import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, SRGBColorSpace, VideoTexture } from "three";
import type { Track } from "livekit-client";
import { toggleScreen, useMedia } from "./media";
import { remoteState, sameFloor, sendScreenUrl, useNet } from "./net";
import { zoneAt } from "./zones";
import { t, useT } from "./i18n";

function useName(id: string) {
  useT();
  return useNet((s) => (id === s.selfId ? t("Kamu") : s.players[id]?.name ?? "?"));
}

function ScreenVideo({ track, className }: { track: Track; className?: string }) {
  const el = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = el.current;
    if (!v) return;
    track.attach(v);
    return () => {
      track.detach(v);
    };
  }, [track]);
  return <video ref={el} className={className} autoPlay playsInline muted />;
}

function ScreenCard({ id, track, onOpen }: { id: string; track: Track; onOpen: () => void }) {
  const name = useName(id);
  const selfId = useNet((s) => s.selfId);
  return (
    <div className="screen-card">
      <button className="screen-thumb" onClick={onOpen} title={t("Perbesar")}>
        <ScreenVideo track={track} />
      </button>
      <div className="screen-meta">
        <span>🖥️ {name}</span>
        {id === selfId && (
          <button className="link" onClick={toggleScreen}>
            {t("Berhenti")}
          </button>
        )}
      </div>
    </div>
  );
}

// Panel share screen dari orang di area yang sama (track orang lain hanya diterima bila satu area).
export function ScreenPanel() {
  const screens = useMedia((s) => s.screens);
  const [open, setOpen] = useState<string | null>(null);
  const list = Object.entries(screens).filter((e): e is [string, Track] => !!e[1]);
  const openTrack = open ? screens[open] : undefined;
  const openName = useName(open ?? "");

  useEffect(() => {
    if (open && !openTrack) setOpen(null);
  }, [open, openTrack]);

  if (!list.length) return null;
  return (
    <>
      <div className="screen-panel">
        {list.map(([id, track]) => (
          <ScreenCard key={id} id={id} track={track} onOpen={() => setOpen(id)} />
        ))}
      </div>
      {open && openTrack && (
        <div className="overlay modal" onClick={() => setOpen(null)}>
          <div className="screen-full" onClick={(e) => e.stopPropagation()}>
            <div className="screen-full-head">
              <span>🖥️ {t("Layar {name}", { name: openName })}</span>
              <button className="secondary" onClick={() => setOpen(null)}>
                {t("Tutup")}
              </button>
            </div>
            <ScreenVideo track={openTrack} className="screen-full-video" />
          </div>
        </div>
      )}
    </>
  );
}

function websiteCard(url: string) {
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
  ctx.font = "bold 72px system-ui, sans-serif";
  ctx.fillText(`🌐 ${host}`, 640, 330);
  ctx.fillStyle = "#aab4cc";
  ctx.font = "34px system-ui, sans-serif";
  ctx.fillText(path, 640, 395);
  ctx.fillText(t("Buka lewat tombol 🌐 Layar untuk melihat & berinteraksi"), 640, 560);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/**
 * Layar presentasi di sebuah zona (ruangan / panggung). Prioritas: share screen dari orang yang sedang berada di
 * zona itu → website yang dipasang di layar → gelap. Track orang lain hanya kita terima bila memang tersambung
 * dengannya (satu area, atau dia di panggung), jadi orang di luar ruangan tetap melihat layar gelap.
 */
export function PresentationMaterial({ zone, itemId }: { zone: string | null; itemId: string }) {
  const myZone = useNet((s) => s.zoneId);
  const selfId = useNet((s) => s.selfId);
  const url = useNet((s) => s.screens[itemId]);
  const screens = useMedia((s) => s.screens);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000); // posisi orang berubah → evaluasi ulang tiap detik
    return () => clearInterval(t);
  }, []);

  const track = useMemo(() => {
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

  const [videoTex, setVideoTex] = useState<VideoTexture | null>(null);
  useEffect(() => {
    if (!track) {
      setVideoTex(null);
      return;
    }
    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    track.attach(el);
    el.play().catch(() => {});
    const t = new VideoTexture(el);
    t.colorSpace = SRGBColorSpace;
    setVideoTex(t);
    return () => {
      track.detach(el);
      t.dispose();
    };
  }, [track]);

  const webTex = useMemo(() => (url ? websiteCard(url) : null), [url]);
  useEffect(() => () => webTex?.dispose(), [webTex]);

  const map = videoTex ?? webTex;
  return map ? (
    <meshBasicMaterial map={map} toneMapped={false} />
  ) : (
    <meshStandardMaterial color="#20232e" emissive="#3a5a8c" emissiveIntensity={0.4} />
  );
}

/** Jendela layar: pasang/ganti website di layar zona ini, dan lihat website-nya penuh. */
export function ScreenModal() {
  useT();
  const itemId = useNet((s) => s.openScreen);
  const url = useNet((s) => (itemId ? s.screens[itemId] : undefined));
  const [draft, setDraft] = useState("");
  useEffect(() => setDraft(url ?? ""), [url, itemId]);
  if (!itemId) return null;
  const close = () => useNet.setState({ openScreen: null });
  return (
    <div className="overlay modal" onKeyDown={(e) => e.key === "Escape" && close()}>
      <div className="web-screen">
        <form
          className="web-screen-head"
          onSubmit={(e) => {
            e.preventDefault();
            sendScreenUrl(itemId, draft.trim());
          }}
        >
          <b>🌐 {t("Layar")}</b>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="https://… (Google Slides, Figma, dashboard)" />
          <button className="primary small">{t("Tampilkan")}</button>
          {url && (
            <button type="button" className="secondary small" onClick={() => sendScreenUrl(itemId, "")}>
              {t("Kosongkan")}
            </button>
          )}
          {url && (
            <a className="secondary small" href={url} target="_blank" rel="noreferrer noopener">
              {t("Tab baru")} ↗
            </a>
          )}
          <button type="button" className="secondary small" onClick={close}>
            {t("Tutup")}
          </button>
        </form>
        {url ? (
          <iframe src={url} title={t("Website di layar")} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerPolicy="no-referrer" />
        ) : (
          <div className="web-empty">{t("Belum ada website di layar ini. Tempel alamat https:// di atas — semua orang di ruangan ini akan melihatnya.")}</div>
        )}
        <p className="muted small web-note">{t('Beberapa situs menolak ditampilkan di dalam halaman lain; kalau kosong, pakai "Tab baru".')}</p>
      </div>
    </div>
  );
}
