import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { Vector3, type Group } from "three";
import { Avatar } from "./Avatar";
import { useKeyboard } from "./useKeyboard";
import { changeFloor, doorPrimaryAction, remoteState, selfPos, sendDoor, sendMove, showNotice, useNet, type Vec3 } from "./net";
import { PROXIMITY, doorNear, ejectPoint, seatNear, world as currentWorld, zoneAt, type Seat } from "./zones";
import { ANIM, EMOTE_KEYS } from "./anims";
import { t as tr } from "./i18n";
import { updateProximity, useMedia } from "./media";
import { pointerLock, touchInput } from "./input";

const WALK = 4;
const RUN = 7;
const SEND_INTERVAL = 1 / 15;
const PROXIMITY_INTERVAL = 1 / 4;
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

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function dampAngle(from: number, to: number, k: number) {
  let d = to - from;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return from + d * k;
}

// ---------- aksi dari luar komponen (tombol HUD, panggil/cari orang) ----------

let teleportImpl: ((x: number, z: number) => void) | null = null;
let toggleSitImpl: (() => void) | null = null;

export const teleportTo = (x: number, z: number) => teleportImpl?.(x, z);

/** Pindah ke dekat titik (x, z) — bila di lantai lain, naik lift dulu. */
export function teleportNear(x: number, z: number, floor = useNet.getState().floor) {
  if (floor !== useNet.getState().floor) changeFloor(floor, [x, 0, z]);
  const angle = Math.random() * Math.PI * 2;
  let tx = x + Math.cos(angle) * 1.1;
  let tz = z + Math.sin(angle) * 1.1;
  // Tetap di area yang sama dengan target (supaya langsung bisa ngobrol), kecuali area itu terkunci.
  const target = zoneAt(x, z);
  const landed = zoneAt(tx, tz);
  if (target && landed?.id !== target.id) [tx, tz] = [x + 0.6, z];
  teleportImpl?.(tx, tz);
}
export const toggleSit = () => toggleSitImpl?.();

/** Kursi sedang diduduki orang lain? (avatar lain berstatus duduk di dekat kursi itu) */
function seatTaken(s: Seat) {
  for (const r of remoteState.values()) if (r.a === ANIM.sit && Math.hypot(r.p[0] - s.x, r.p[2] - s.z) < 0.4) return true;
  return false;
}

export function Player() {
  const self = useNet((s) => s.self)!;
  const spawn = useNet((s) => s.spawn);
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<Group>(null);
  const { held: keys, pressed } = useKeyboard();
  const anim = useRef<number>(ANIM.idle);
  const emote = useRef<{ anim: number; until: number } | null>(null);
  const seat = useRef<Seat | null>(null);
  const tmp = useRef(new Vector3());
  const zoom = useRef(ZOOM_DEFAULT);
  const yaw = useRef(0); // 0 = kamera di selatan avatar, melihat ke utara
  const pitchOffset = useRef(0);
  const { world, rapier } = useRapier();
  const canvas = useThree((s) => s.gl.domElement);

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
      if (dragging !== e.pointerId || pointerLock.editor) return;
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

  const standUp = () => {
    const b = body.current;
    const s = seat.current;
    if (!b || !s) return;
    seat.current = null;
    b.setEnabled(true);
    b.setTranslation({ x: s.stand[0], y: 0.1, z: s.stand[1] }, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    useNet.setState({ sitting: false });
  };

  const sitOn = (s: Seat) => {
    const b = body.current;
    if (!b || !visual.current) return;
    seat.current = s;
    emote.current = null;
    // Selama duduk, badan fisik dinonaktifkan supaya tidak bertabrakan dengan sofa/meja.
    b.setEnabled(false);
    b.setTranslation({ x: s.x, y: 0, z: s.z }, true);
    visual.current.rotation.y = s.yaw;
    useNet.setState({ sitting: true, nearSeat: null });
  };

  useEffect(() => {
    teleportImpl = (x, z) => {
      if (seat.current) standUp();
      body.current?.setTranslation({ x, y: 0.1, z }, true);
      body.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
    };
    toggleSitImpl = () => {
      if (seat.current) return standUp();
      const t = body.current?.translation();
      const s = t && seatNear(t.x, t.z, seatTaken);
      if (s) sitOn(s);
    };
    // Hook debug untuk tes otomatis (hanya mode dev).
    if (import.meta.env.DEV) {
      const vo = (window as unknown as { __vo?: Record<string, unknown> }).__vo;
      if (vo) vo.teleport = teleportImpl;
    }
    return () => {
      teleportImpl = null;
      toggleSitImpl = null;
    };
  }, []);

  const lookAt = useRef(new Vector3(...spawn));
  const camTarget = useRef(new Vector3());
  const sendTimer = useRef(0);
  const proximityTimer = useRef(0);
  const lastSent = useRef("");
  const lastValid = useRef<[number, number] | null>(null);
  const lastNotice = useRef(0);
  const followStuck = useRef({ dist: Infinity, since: 0 });

  useFrame((state, dt) => {
    const b = body.current;
    const v = visual.current;
    if (!b || !v) return;
    const k = keys.current;
    const now = state.clock.elapsedTime;

    if (k.has("KeyQ")) yaw.current += KEY_TURN_SPEED * dt;
    if (k.has("KeyE")) yaw.current -= KEY_TURN_SPEED * dt;

    // Input relatif terhadap arah kamera: W = maju menjauhi kamera. Joystick sentuh ikut dijumlahkan.
    let fwd = touchInput.y;
    let side = touchInput.x;
    if (k.has("KeyW") || k.has("ArrowUp")) fwd += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) fwd -= 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) side -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) side += 1;
    const sy = Math.sin(yaw.current);
    const cy = Math.cos(yaw.current);
    let x = -sy * fwd + cy * side;
    let z = -cy * fwd - sy * side;
    let len = Math.hypot(x, z);
    if (len < 0.15) len = 0; // zona mati joystick
    let running = k.has("ShiftLeft") || k.has("ShiftRight") || Math.hypot(touchInput.x, touchInput.y) > 0.92;

    // Mode ikuti: jalan otomatis ke orang yang diikuti; tombol gerak = berhenti mengikuti.
    const following = useNet.getState().following;
    if (following && len > 0) useNet.setState({ following: null });
    else if (following) {
      const target = remoteState.get(following);
      const info = useNet.getState().players[following];
      const here = b.translation();
      if (!target || !info) useNet.setState({ following: null });
      else if (info.floor !== useNet.getState().floor) {
        teleportNear(target.p[0], target.p[2], info.floor); // ikut naik lift
      } else {
        const dx = target.p[0] - here.x;
        const dz = target.p[2] - here.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 1.8) {
          x = dx / dist;
          z = dz / dist;
          len = 1;
          running = dist > 6;
          // Tersangkut (dinding/furnitur) → lompat ke dekatnya.
          if (dist >= followStuck.current.dist - 0.05) {
            if (now - followStuck.current.since > 2.5) {
              teleportNear(target.p[0], target.p[2]);
              followStuck.current = { dist: Infinity, since: now };
            }
          } else followStuck.current = { dist, since: now };
        }
      }
    }
    const speed = running ? RUN : WALK;

    // Duduk / berdiri (C). Bergerak saat duduk = berdiri.
    if (pressed.current.has("KeyC")) {
      pressed.current.delete("KeyC");
      toggleSitImpl?.();
    }
    if (seat.current && len > 0 && !following) standUp();
    if (seat.current && following) useNet.setState({ following: null });

    // Emote (1/2/3) — dibatalkan begitu avatar bergerak.
    for (const code in EMOTE_KEYS) {
      if (!pressed.current.has(code)) continue;
      pressed.current.delete(code);
      if (seat.current) continue;
      const e = EMOTE_KEYS[code];
      emote.current = { anim: e.anim, until: e.duration === null ? Infinity : now + e.duration };
    }
    if (len > 0 || (emote.current && now >= emote.current.until)) emote.current = null;

    if (seat.current) {
      anim.current = ANIM.sit;
    } else {
      anim.current = len > 0 ? (running ? ANIM.run : ANIM.walk) : (emote.current?.anim ?? ANIM.idle);
      if (len > 0) {
        const n = Math.max(1, len);
        x /= n;
        z /= n;
        v.rotation.y = dampAngle(v.rotation.y, Math.atan2(x, z), 1 - Math.exp(-12 * dt));
      }
      const vel = b.linvel();
      b.setLinvel({ x: x * speed, y: vel.y, z: z * speed }, true);
    }

    // Kamera orbit mengikuti dengan halus; maju mendekat bila terhalang tembok.
    const t = b.translation();
    const zm = zoom.current;
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
    const smooth = 1 - Math.exp(-8 * dt);
    state.camera.position.lerp(camTarget.current, smooth);
    lookAt.current.lerp(head, smooth);
    state.camera.lookAt(lookAt.current);

    // Meja terkunci milik orang lain tidak bisa dimasuki: kembalikan ke posisi sah terakhir / dorong keluar.
    const { desks, selfId } = useNet.getState();
    const lockedFor = (px: number, pz: number) => {
      const zn = zoneAt(px, pz);
      const d = zn ? desks[zn.id] : undefined;
      return d && d.locked && d.ownerId !== selfId ? zn : null;
    };
    const blocked = lockedFor(t.x, t.z);
    if (blocked) {
      if (seat.current) standUp();
      const lv = lastValid.current;
      const [ex, ez] = lv && !lockedFor(lv[0], lv[1]) ? lv : ejectPoint(blocked, t.x, t.z);
      b.setTranslation({ x: ex, y: t.y, z: ez }, true);
      b.setLinvel({ x: 0, y: b.linvel().y, z: 0 }, true);
      if (now - lastNotice.current > 3) {
        lastNotice.current = now;
        showNotice(`🔒 ${tr("{name} sedang mode fokus — jangan diganggu dulu ya", { name: desks[blocked.id].ownerName })}`);
      }
      t.x = ex;
      t.z = ez;
    } else {
      lastValid.current = [t.x, t.z];
    }
    selfPos.p = [t.x, t.y, t.z];

    const here = zoneAt(t.x, t.z);
    const zone = here?.name ?? null;
    if (useNet.getState().zoneId !== (here?.id ?? null)) useNet.setState({ zone, zoneId: here?.id ?? null });

    // Pintu terdekat: F untuk buka/tutup/ketuk.
    const door = doorNear(t.x, t.z);
    if (useNet.getState().nearDoor !== (door?.id ?? null)) useNet.setState({ nearDoor: door?.id ?? null });
    if (pressed.current.has("KeyF")) {
      pressed.current.delete("KeyF");
      if (door) sendDoor(door.id, doorPrimaryAction(door.id, here?.id === door.room));
    }

    // Audio/video proximity + kursi terdekat (beberapa kali per detik saja).
    proximityTimer.current += dt;
    if (proximityTimer.current >= PROXIMITY_INTERVAL) {
      proximityTimer.current = 0;
      updateProximity(t.x, t.z);
      const near = seat.current ? null : (seatNear(t.x, t.z, seatTaken)?.id ?? null);
      if (useNet.getState().nearSeat !== near) useNet.setState({ nearSeat: near });
      const lift = currentWorld().elevators.some((e) => Math.hypot(e.exit[0] - t.x, e.exit[1] - t.z) < 2.2);
      if (useNet.getState().nearLift !== lift) useNet.setState({ nearLift: lift });
    }

    // Kirim posisi maks 15x/detik, hanya kalau berubah.
    sendTimer.current += dt;
    if (sendTimer.current >= SEND_INTERVAL) {
      sendTimer.current = 0;
      const p: Vec3 = [t.x, t.y, t.z];
      const r = v.rotation.y;
      const key = `${p.map((n) => n.toFixed(2)).join()}|${r.toFixed(2)}|${anim.current}`;
      if (key !== lastSent.current) {
        lastSent.current = key;
        sendMove(p, r, anim.current);
      }
    }
  });

  // Kalau denah berubah dan kursi yang diduduki hilang, berdiri.
  const derived = useNet((s) => s.derived);
  useEffect(() => {
    if (seat.current && !currentWorld().seats.some((s) => s.id === seat.current!.id)) standUp();
  }, [derived]);

  return (
    <RigidBody ref={body} position={spawn} colliders={false} enabledRotations={[false, false, false]} ccd>
      <CapsuleCollider args={[0.5, 0.35]} position={[0, 0.85, 0]} friction={0} />
      <RadiusRing />
      <group ref={visual}>
        <Avatar id={self.id} name={self.name} avatar={self.avatar} getAnim={() => anim.current} isSelf />
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
