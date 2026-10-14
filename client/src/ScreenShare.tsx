import { useEffect, useRef, useState } from "react";
import { SRGBColorSpace, VideoTexture } from "three";
import type { Track } from "livekit-client";
import { toggleScreen, useMedia } from "./media";
import { useNet } from "./net";

function useName(id: string) {
  return useNet((s) => (id === s.selfId ? "Kamu" : s.players[id]?.name ?? "?"));
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
      <button className="screen-thumb" onClick={onOpen} title="Perbesar">
        <ScreenVideo track={track} />
      </button>
      <div className="screen-meta">
        <span>🖥️ {name}</span>
        {id === selfId && (
          <button className="link" onClick={toggleScreen}>
            Berhenti
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
              <span>🖥️ Layar {openName}</span>
              <button className="secondary" onClick={() => setOpen(null)}>
                Tutup
              </button>
            </div>
            <ScreenVideo track={openTrack} className="screen-full-video" />
          </div>
        </div>
      )}
    </>
  );
}

// Material layar presentasi di sebuah ruangan: menampilkan share screen orang di ruangan itu
// (track orang lain hanya kita terima bila satu area, jadi orang di luar ruangan melihat layar gelap).
export function PresentationMaterial({ room }: { room: string | null }) {
  const inMeeting = useNet((s) => !!room && s.zoneId === `room:${room}`);
  const track = useMedia((s) => Object.values(s.screens).find(Boolean));
  const [tex, setTex] = useState<VideoTexture | null>(null);

  useEffect(() => {
    if (!inMeeting || !track) {
      setTex(null);
      return;
    }
    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    track.attach(el);
    el.play().catch(() => {});
    const t = new VideoTexture(el);
    t.colorSpace = SRGBColorSpace;
    setTex(t);
    return () => {
      track.detach(el);
      t.dispose();
    };
  }, [inMeeting, track]);

  return tex ? (
    <meshBasicMaterial map={tex} toneMapped={false} />
  ) : (
    <meshStandardMaterial color="#20232e" emissive="#3a5a8c" emissiveIntensity={0.4} />
  );
}
