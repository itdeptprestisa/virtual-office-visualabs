import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { Vector3, type Group, type OrthographicCamera } from "three";
import { useGraphics } from "./graphics";
import { Avatar } from "./Avatar";
import { useKeyboard } from "./useKeyboard";
import { selfPos, useNet } from "./net";
import { PROXIMITY, world as currentWorld } from "./zones";
import { useMedia } from "./media";
import { pointerLock, touchInput } from "./input";
import { createController, seatMissing, type Motion } from "./controller";
import { defaultIO } from "./controllerIO";
import { setActiveController } from "./actions";

export { dampAngle } from "./controller";
export { teleportNear, teleportTo, toggleSit } from "./actions";

// Kamera mengikuti avatar. Satu nilai zoom (0..1) mengatur jarak, sudut & titik fokus sekaligus:
//   0   = dekat di belakang punggung, sudut landai (third-person ala GTA)
//   ~0.8 = default, pandangan luas dari atas (bird's-eye)
//   1   = paling jauh, seluruh kantor terlihat
// Drag/Q-E memutar; drag vertikal menggeser kemiringan sedikit dari kurva bawaan.
const DIST_NEAR = 3.5;
const DIST_FAR = 32;
const PITCH_NEAR = 0.22; // ±13°
const PITCH_FAR = 1.1; // ±63°
const LOOK_NEAR = 1.55; // setinggi kepala
const LOOK_FAR = 1;
const ZOOM_DEFAULT = 0.8;
const PITCH_OFFSET_LIMIT = 0.5;
const KEY_TURN_SPEED = 2.2; // rad/detik
// Mode 2.5D: kamera ortografis, sudut tetap (menghadap utara, ±55° dari lantai), zoom = skala piksel per meter.
const FLAT_PITCH = 0.96;
const FLAT_DIST = 50;
const flatZoom = (zm: number) => Math.min(120, 28 * Math.pow(2.2, (ZOOM_DEFAULT - zm) * 5));
const isFlat = () => useGraphics.getState().quality === "flat";

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function Player() {
  const self = useNet((s) => s.self)!;
  // Mulai dari posisi terakhir (mis. setelah pindah dari mode 2D), bila belum ada pakai titik muncul.
  const spawn = useMemo(() => selfPos.p ?? useNet.getState().spawn, []);
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<Group>(null);
  const { held: keys, pressed } = useKeyboard();
  const tmp = useRef(new Vector3());
  const zoom = useRef(ZOOM_DEFAULT);
  const yaw = useRef(0); // 0 = kamera di selatan avatar, melihat ke utara
  const pitchOffset = useRef(0);
  const { world, rapier } = useRapier();
  const canvas = useThree((s) => s.gl.domElement);

  // Mesin gerak 3D = badan Rapier.
  const controller = useMemo(() => {
    const motion: Motion = {
      position: () => {
        const t = body.current?.translation();
        return t ? [t.x, t.y, t.z] : [spawn[0], spawn[1], spawn[2]];
      },
      setVelocity: (vx, vz) => {
        const b = body.current;
        if (b) b.setLinvel({ x: vx, y: b.linvel().y, z: vz }, true);
      },
      teleport: (x, z, y) => {
        const b = body.current;
        if (b) b.setTranslation({ x, y: y ?? (b.isEnabled() ? 0.1 : 0), z }, true);
      },
      setEnabled: (on) => body.current?.setEnabled(on),
    };
    return createController(motion, { held: keys.current, pressed: pressed.current, touch: touchInput }, defaultIO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Saat dilepas (ganti mode tampilan): berdiri dulu supaya status duduk tidak tertinggal.
  useEffect(() => {
    const release = setActiveController(controller);
    return () => {
      if (controller.seat) controller.standUp();
      release();
    };
  }, [controller]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.target !== canvas) return;
      zoom.current = Math.min(1, Math.max(0, zoom.current + e.deltaY * 0.0008));
    };
    // Drag di kanvas (mouse/sentuh) untuk memutar kamera — kecuali sedang menggeser furnitur di editor.
    let dragging: number | null = null;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      if (pointerLock.editor) return;
      dragging = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (dragging !== e.pointerId || pointerLock.editor || isFlat()) return;
      yaw.current -= (e.clientX - lastX) * 0.006;
      pitchOffset.current = Math.min(PITCH_OFFSET_LIMIT, Math.max(-PITCH_OFFSET_LIMIT, pitchOffset.current + (e.clientY - lastY) * 0.004));
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (dragging === e.pointerId) dragging = null;
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.style.touchAction = "none";
    return () => {
      window.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [canvas]);

  const lookAt = useRef(new Vector3(...spawn));
  const camTarget = useRef(new Vector3());

  useFrame((state, dt) => {
    const b = body.current;
    const v = visual.current;
    if (!b || !v) return;
    const k = keys.current;

    const flat = isFlat();
    if (flat) {
      yaw.current = 0; // 2.5D: arah kamera dikunci
      pitchOffset.current = 0;
    } else {
      if (k.has("KeyQ")) yaw.current += KEY_TURN_SPEED * dt;
      if (k.has("KeyE")) yaw.current -= KEY_TURN_SPEED * dt;
    }
    controller.step(dt, state.clock.elapsedTime, yaw.current);
    v.rotation.y = controller.facing;

    // Kamera orbit mengikuti dengan halus; maju mendekat bila terhalang tembok.
    const t = b.translation();
    const zm = zoom.current;
    const smooth = 1 - Math.exp(-8 * dt);
    if (flat) {
      const cam = state.camera as OrthographicCamera;
      const head = tmp.current.set(t.x, t.y + 1, t.z);
      camTarget.current.set(head.x, head.y + Math.sin(FLAT_PITCH) * FLAT_DIST, head.z + Math.cos(FLAT_PITCH) * FLAT_DIST);
      cam.position.lerp(camTarget.current, smooth);
      lookAt.current.lerp(head, smooth);
      cam.lookAt(lookAt.current);
      if (cam.isOrthographicCamera) {
        const z = flatZoom(zm);
        if (Math.abs(cam.zoom - z) > 0.01) {
          cam.zoom += (z - cam.zoom) * smooth;
          cam.updateProjectionMatrix();
        }
      }
      return;
    }
    const sy = Math.sin(yaw.current);
    const cy = Math.cos(yaw.current);
    const pitch = Math.min(1.45, Math.max(0.05, lerp(PITCH_NEAR, PITCH_FAR, smoothstep(0.1, 0.75, zm)) + pitchOffset.current));
    const head = tmp.current.set(t.x, t.y + lerp(LOOK_NEAR, LOOK_FAR, smoothstep(0, 0.6, zm)), t.z);
    const cp = Math.cos(pitch);
    const dir = { x: sy * cp, y: Math.sin(pitch), z: cy * cp };
    let dist = DIST_NEAR * Math.pow(DIST_FAR / DIST_NEAR, zm);
    const hit = world.castRay(
      new rapier.Ray(head, dir),
      dist,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      (c) => (c.parent()?.userData as { blocksCamera?: boolean } | undefined)?.blocksCamera === true,
    );
    if (hit) dist = Math.max(0.8, hit.timeOfImpact - 0.3);
    camTarget.current.set(head.x + dir.x * dist, head.y + dir.y * dist, head.z + dir.z * dist);
    state.camera.position.lerp(camTarget.current, smooth);
    lookAt.current.lerp(head, smooth);
    state.camera.lookAt(lookAt.current);
  });

  // Kalau denah berubah dan kursi yang diduduki hilang, berdiri.
  const derived = useNet((s) => s.derived);
  useEffect(() => {
    if (seatMissing(controller.seat, currentWorld().seats)) controller.standUp();
  }, [derived, controller]);

  return (
    <RigidBody ref={body} position={spawn} colliders={false} enabledRotations={[false, false, false]} ccd>
      <CapsuleCollider args={[0.5, 0.35]} position={[0, 0.85, 0]} friction={0} />
      <RadiusRing />
      <group ref={visual}>
        <Avatar id={self.id} name={self.name} avatar={self.avatar} getAnim={() => controller.anim} isSelf />
      </group>
    </RigidBody>
  );
}

// Lingkaran radius dengar di lantai (hanya saat di luar area); hijau bila ada orang di dalamnya.
function RadiusRing() {
  const inZone = useNet((s) => s.zone !== null);
  const sitting = useNet((s) => s.sitting);
  const someone = useMedia((s) => s.nearby > 0);
  if (inZone || sitting) return null;
  const color = someone ? "#4caf72" : "#5b8def";
  return (
    <group position-y={0.02} rotation-x={-Math.PI / 2}>
      <mesh>
        <ringGeometry args={[PROXIMITY.hear - 0.06, PROXIMITY.hear, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[PROXIMITY.hear, 96]} />
        <meshBasicMaterial color={color} transparent opacity={someone ? 0.1 : 0.05} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
