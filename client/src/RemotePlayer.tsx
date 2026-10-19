import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { Avatar } from "./Avatar";
import { remoteState, type PlayerInfo } from "./net";
import { sampleRemote } from "./interp";

export function RemotePlayer({ info }: { info: PlayerInfo }) {
  const group = useRef<Group>(null);
  const inner = useRef<Group>(null);

  useFrame(() => {
    const g = group.current;
    const s = sampleRemote(info.id, performance.now());
    if (!g || !inner.current || !s) return;
    g.position.set(s.p[0], s.p[1], s.p[2]);
    inner.current.rotation.y = s.r;
  });

  return (
    <group ref={group}>
      <group ref={inner}>
        <Avatar id={info.id} name={info.name} avatar={info.avatar} getAnim={() => remoteState.get(info.id)?.a ?? 0} />
      </group>
    </group>
  );
}
