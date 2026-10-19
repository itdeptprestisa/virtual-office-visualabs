import { useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Group } from "three";
import { ANIM } from "./anims";
import { useNet } from "./net";
import { AvatarLabel } from "./avatarLabel";
import { Character, CharacterLow } from "./avatar/Character";
import type { AvatarConfig } from "./avatar/config";

const HEIGHT = 1.8;
const LABEL_Y = HEIGHT + 0.3;
const SIT_DROP = 0.4; // saat duduk kepala turun ±0,4 m — label ikut turun
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
  return (
    <group ref={holder}>
      {low ? (
        <CharacterLow config={avatar} getAnim={getAnim} />
      ) : (
        <Character config={avatar} getAnim={getAnim} handUp={hand} castShadows={!!isSelf} />
      )}
      <group ref={label} position-y={LABEL_Y}>
        <Html center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <AvatarLabel id={id} name={name} color={color} isSelf={isSelf} far={low} />
        </Html>
      </group>
    </group>
  );
}
