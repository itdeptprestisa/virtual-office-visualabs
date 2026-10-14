import { useEffect, useRef, useState } from "react";
import type { Track } from "livekit-client";
import { Html } from "@react-three/drei";
import { useNet } from "./net";
import { useMedia } from "./media";
import { Character } from "./avatar/Character";
import type { AvatarConfig } from "./avatar/config";

const HEIGHT = 1.8;
const BUBBLE_MS = 6000;

interface Props {
  id: string;
  name: string;
  avatar: AvatarConfig;
  getAnim: () => number;
  isSelf?: boolean;
}

export function Avatar({ id, name, avatar, getAnim, isSelf }: Props) {
  const color = avatar.topColor;
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
    <group>
      <Character config={avatar} getAnim={getAnim} handUp={hand} />
      <Html position={[0, HEIGHT + 0.3, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="avatar-label">
          {showBubble && bubble && <div className="bubble">{bubble.text}</div>}
          {video && <VideoBubble track={video} mirror={isSelf} color={color} speaking={speaking} />}
          <div className={`nameplate${isSelf ? " self" : ""}${speaking ? " speaking" : ""}`}>
            {hand && "✋ "}
            {speaking && "🔊 "}
            {name}
          </div>
        </div>
      </Html>
    </group>
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
