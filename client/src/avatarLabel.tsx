import { useEffect, useRef, useState } from "react";
import type { Track } from "livekit-client";
import { useNet } from "./net";
import { useMedia } from "./media";
import { HandPalmIcon, SpeakerHighIcon } from "./ui/icons";

const BUBBLE_MS = 6000;

/** Nama, ikon tangan/bicara, gelembung chat, dan video bulat di atas kepala avatar — HTML murni, dipakai 3D (lewat <Html>) & 2D. */
export function AvatarLabel({ id, name, color, isSelf, far }: { id: string; name: string; color: string; isSelf?: boolean; far?: boolean }) {
  const bubble = useNet((s) => s.bubbles[id]);
  const video = useMedia((s) => s.videos[id]);
  const speaking = useMedia((s) => !!s.speaking[id]);
  const hand = useNet((s) => s.directory.find((u) => u.id === id)?.hand ?? false);
  const [showBubble, setShowBubble] = useState(false);
  useEffect(() => {
    if (!bubble) return;
    const left = BUBBLE_MS - (Date.now() - bubble.ts);
    if (left <= 0) return;
    setShowBubble(true);
    const timer = setTimeout(() => setShowBubble(false), left);
    return () => clearTimeout(timer);
  }, [bubble]);
  return (
    <div className="avatar-label">
      {showBubble && bubble && <div className="bubble">{bubble.text}</div>}
      {video && <VideoBubble track={video} mirror={isSelf} color={color} speaking={speaking} />}
      <div className={`nameplate${isSelf ? " self" : ""}${speaking ? " speaking" : ""}${far ? " far" : ""}`}>
        {hand && <HandPalmIcon weight="fill" />}
        {speaking && <SpeakerHighIcon weight="fill" />}
        {(hand || speaking) && " "}
        {name}
      </div>
    </div>
  );
}

// Video bulat melayang di atas kepala — pengganti grid video di pojok layar.
function VideoBubble({ track, mirror, color, speaking }: { track: Track; mirror?: boolean; color: string; speaking: boolean }) {
  const el = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = el.current;
    if (!v) return;
    track.attach(v);
    return () => {
      track.detach(v);
    };
  }, [track]);

  return (
    <video
      ref={el}
      className={speaking ? "video-bubble speaking" : "video-bubble"}
      style={{ borderColor: color, transform: mirror ? "scaleX(-1)" : undefined }}
      autoPlay
      playsInline
      muted
    />
  );
}
