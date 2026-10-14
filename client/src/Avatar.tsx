import { useEffect, useRef, useState } from "react";
import type { Track } from "livekit-client";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CircleGeometry, MeshBasicMaterial, Vector3, type Group } from "three";
import { ANIM } from "./anims";
import { useNet } from "./net";
import { useMedia } from "./media";
import { Character, CharacterLow } from "./avatar/Character";
import type { AvatarConfig } from "./avatar/config";

const HEIGHT = 1.8;
const LABEL_Y = HEIGHT + 0.3;
const SIT_DROP = 0.4; // saat duduk kepala turun ±0,4 m — label ikut turun
const BUBBLE_MS = 6000;
// Avatar orang lain yang jauh dari kamera digambar versi sederhana (jeda 13–15 m supaya tidak berkedip).
const LOD_FAR = 15;
const LOD_NEAR = 13;
const tmp = new Vector3();

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
  const label = useRef<Group>(null);
  const holder = useRef<Group>(null);
  const [low, setLow] = useState(false);
  useFrame(({ camera }, dt) => {
    if (!isSelf && holder.current) {
      const d = holder.current.getWorldPosition(tmp).distanceTo(camera.position);
      if (!low && d > LOD_FAR) setLow(true);
      else if (low && d < LOD_NEAR) setLow(false);
    }
    if (!label.current) return;
    const target = getAnim() === ANIM.sit ? LABEL_Y - SIT_DROP : LABEL_Y;
    label.current.position.y += (target - label.current.position.y) * (1 - Math.exp(-10 * Math.min(dt, 0.1)));
  });
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
    <group ref={holder}>
      {low ? (
        <CharacterLow config={avatar} getAnim={getAnim} />
      ) : (
        <Character config={avatar} getAnim={getAnim} handUp={hand} castShadows={!!isSelf} />
      )}
      {!isSelf && <BlobShadow />}
      <group ref={label} position-y={LABEL_Y}>
        <Html center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="avatar-label">
            {showBubble && bubble && <div className="bubble">{bubble.text}</div>}
            {video && <VideoBubble track={video} mirror={isSelf} color={color} speaking={speaking} />}
            <div className={`nameplate${isSelf ? " self" : ""}${speaking ? " speaking" : ""}${low ? " far" : ""}`}>
              {hand && "✋ "}
              {speaking && "🔊 "}
              {name}
            </div>
          </div>
        </Html>
      </group>
    </group>
  );
}

// Bayangan murah untuk avatar orang lain: satu lingkaran gelap lembut di kaki (pengganti shadow map).
const BLOB_GEO = new CircleGeometry(0.42, 24);
const BLOB_MAT = new MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.22, depthWrite: false });
function BlobShadow() {
  return <mesh geometry={BLOB_GEO} material={BLOB_MAT} rotation-x={-Math.PI / 2} position-y={0.012} renderOrder={1} />;
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
