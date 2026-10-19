import { useEffect, useRef, useState } from "react";
import type { Track } from "livekit-client";
import { toggleScreen, useMedia } from "./media";
import { sendScreenUrl, useNet } from "./net";
import { t, useT } from "./i18n";
import { GlobeIcon, MonitorIcon } from "./ui/icons";

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
        <span>
          <MonitorIcon /> {name}
        </span>
        {id === selfId && (
          <button className="link" onClick={toggleScreen} title={t("Berhenti share screen")}>
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
              <span>
                <MonitorIcon /> {t("Layar {name}", { name: openName })}
              </span>
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
          <b>
            <GlobeIcon /> {t("Layar")}
          </b>
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
