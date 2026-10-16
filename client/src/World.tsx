import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { Html, Line } from "@react-three/drei";
import { Color, DoubleSide, type Mesh } from "three";
import { WORLD, angleOf, inZone, type Door, type Item, type Zone } from "../../shared/layout";
import { useNet, type DeskState } from "./net";
import { COLLIDERS, FOOTPRINT, Furniture } from "./Furniture";
import { moveItem, snap, useEditor } from "./editor";
import { pointerLock } from "./input";
import { locale, t, useT } from "./i18n";

// Kantor digambar dari data denah (useNet.layout); bentuk turunan (area, pintu, dinding) dari useNet.derived.

const { minX, maxX, minZ, maxZ, wallH: WALL_H } = WORLD;
const W = (maxX - minX) / 2; // setengah lebar & kedalaman gedung
const D = (maxZ - minZ) / 2;
const CX = (minX + maxX) / 2; // titik tengah gedung (tidak di 0,0: gedung diperluas ke utara)
const CZ = (minZ + maxZ) / 2;
const FLOOR = "#ead8bf";
const WALL = "#f6f1ea";
const WALL_TRIM = "#d9cbb6";
const LOCKED_COLOR = "#e5484d";
const MARK_Y = 0.015;

type V3 = [number, number, number];

function Block({ size, position, color, blocksCamera }: { size: V3; position: V3; color: string; blocksCamera?: boolean }) {
  return (
    <RigidBody type="fixed" colliders="cuboid" position={position} userData={{ blocksCamera }}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    </RigidBody>
  );
}

function Shell() {
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W, 0.1, D]} position={[CX, -0.1, CZ]} />
      </RigidBody>
      <mesh rotation-x={-Math.PI / 2} position={[CX, 0, CZ]} receiveShadow>
        <planeGeometry args={[W * 2, D * 2]} />
        <meshStandardMaterial color={FLOOR} roughness={0.9} />
      </mesh>
      {/* utara & samping tinggi (menghalangi kamera), selatan rendah */}
      <Block size={[W * 2, WALL_H, 0.3]} position={[CX, WALL_H / 2, minZ]} color={WALL} blocksCamera />
      <Block size={[0.3, WALL_H, D * 2]} position={[minX, WALL_H / 2, CZ]} color={WALL} blocksCamera />
      <Block size={[0.3, WALL_H, D * 2]} position={[maxX, WALL_H / 2, CZ]} color={WALL} blocksCamera />
      <Block size={[W * 2, 0.6, 0.3]} position={[CX, 0.3, maxZ]} color={WALL_TRIM} />
      {[-12, -6].map((x) => (
        <mesh key={x} position={[x, 1.8, minZ + 0.16]}>
          <planeGeometry args={[3.2, 1.4]} />
          <meshStandardMaterial color="#cfe8ff" emissive="#cfe8ff" emissiveIntensity={0.6} />
        </mesh>
      ))}
    </>
  );
}

// ---------- ruangan: lantai berwarna + dinding kaca + pintu ----------

const EMPTY: never[] = [];
const useFloor = () => useNet((s) => s.layout?.floors.find((f) => f.id === s.floor));

function RoomFloors() {
  const rooms = useFloor()?.rooms ?? EMPTY;
  return (
    <>
      {rooms.map((r) => {
        const tint = "#" + new Color(r.color).lerp(new Color("#ffffff"), 0.72).getHexString();
        return (
          <mesh key={r.id} rotation-x={-Math.PI / 2} position={[(r.x[0] + r.x[1]) / 2, 0.005, (r.z[0] + r.z[1]) / 2]} receiveShadow>
            <planeGeometry args={[r.x[1] - r.x[0], r.z[1] - r.z[0]]} />
            <meshStandardMaterial color={tint} roughness={1} />
          </mesh>
        );
      })}
    </>
  );
}

function GlassWalls() {
  const walls = useNet((s) => s.derived?.walls ?? EMPTY);
  return (
    <>
      {walls.map((w) => {
        const len = w.a[1] - w.a[0];
        const mid = (w.a[0] + w.a[1]) / 2;
        const pos: V3 = w.orient === "x" ? [mid, 1.3, w.c] : [w.c, 1.3, mid];
        const size: V3 = w.orient === "x" ? [len, 2.6, 0.1] : [0.1, 2.6, len];
        const ends: V3[] =
          w.orient === "x"
            ? [[w.a[0], 1.3, w.c], [w.a[1], 1.3, w.c]]
            : [[w.c, 1.3, w.a[0]], [w.c, 1.3, w.a[1]]];
        return (
          <group key={`${w.orient}:${w.c}:${w.a[0]}:${w.a[1]}`}>
            <RigidBody type="fixed" colliders="cuboid" position={pos}>
              <mesh>
                <boxGeometry args={size} />
                <meshStandardMaterial color="#bfe3ff" transparent opacity={0.22} roughness={0.1} depthWrite={false} />
              </mesh>
            </RigidBody>
            {ends.map((p, j) => (
              <mesh key={j} position={p}>
                <boxGeometry args={[0.12, 2.6, 0.12]} />
                <meshStandardMaterial color={WALL_TRIM} />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}

// Pintu kaca geser dua daun. Tertutup = ada collider; terkunci = kemerahan + label.
function DoorView({ door }: { door: Door }) {
  const open = useNet((s) => s.doors[door.id]?.open ?? true);
  const locked = useNet((s) => s.doors[door.id]?.locked ?? false);
  const left = useRef<Mesh>(null);
  const right = useRef<Mesh>(null);
  const booking = useBookingLabel(door.id);
  const half = (door.a[1] - door.a[0]) / 2;
  const mid = (door.a[0] + door.a[1]) / 2;

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-7 * Math.min(dt, 0.1));
    const slide = open ? half * 0.92 : 0;
    if (left.current) left.current.position.x += (-half / 2 - slide - left.current.position.x) * k;
    if (right.current) right.current.position.x += (half / 2 + slide - right.current.position.x) * k;
  });

  const leaf = (sign: 1 | -1) => (
    <mesh ref={sign < 0 ? left : right} position={[(sign * half) / 2, 1.25, 0.08]}>
      <boxGeometry args={[half, 2.5, 0.05]} />
      <meshStandardMaterial color={locked ? "#f2a3a6" : "#9fd0f5"} transparent opacity={locked ? 0.55 : 0.38} roughness={0.1} depthWrite={false} />
      <mesh position={[(-sign * half) / 2 + sign * 0.08, 0, 0.04]}>
        <boxGeometry args={[0.04, 0.5, 0.04]} />
        <meshStandardMaterial color="#3b3f51" />
      </mesh>
    </mesh>
  );

  return (
    <group position={door.orient === "x" ? [mid, 0, door.c] : [door.c, 0, mid]} rotation-y={door.orient === "x" ? 0 : Math.PI / 2}>
      {leaf(-1)}
      {leaf(1)}
      {(locked || booking) && (
        <Html position={[0, 2.85, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
          <div className="door-labels">
            {locked && <div className="desk-label locked">🔒 {t("Terkunci")}</div>}
            {booking && <div className={booking.now ? "desk-label booked" : "desk-label"}>{booking.text}</div>}
          </div>
        </Html>
      )}
      {!open && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[half, 1.25, 0.1]} position={[0, 1.25, 0]} />
        </RigidBody>
      )}
    </group>
  );
}

const hhmm = (ts: number) => new Date(ts).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });

/** Label jadwal di atas pintu: yang sedang berlangsung, atau booking berikutnya hari ini. Diperbarui tiap 30 detik. */
function useBookingLabel(roomId: string) {
  useT();
  const bookings = useNet((s) => s.bookings);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const mine = bookings.filter((b) => b.room === roomId && b.end > now);
  const current = mine.find((b) => b.start <= now);
  if (current) return { now: true, text: `📅 ${current.title} · ${t("s/d")} ${hhmm(current.end)}` };
  const next = mine.find((b) => new Date(b.start).toDateString() === new Date(now).toDateString());
  return next ? { now: false, text: `📅 ${t("Berikutnya")} ${hhmm(next.start)} · ${next.title}` } : null;
}

function Doors() {
  const doors = useNet((s) => s.derived?.doors ?? EMPTY);
  return (
    <>
      {doors.map((d) => (
        <DoorView key={`${d.id}:${d.orient}:${d.c}:${d.a[0]}:${d.a[1]}`} door={d} />
      ))}
    </>
  );
}

// ---------- penanda area di lantai ----------

function ZoneMarker({ zone, active, color = zone.color }: { zone: Zone; active: boolean; color?: string }) {
  const outline = useMemo(() => {
    if (zone.shape === "rect") {
      const [x0, x1] = zone.x;
      const [z0, z1] = zone.z;
      return [[x0, MARK_Y, z0], [x1, MARK_Y, z0], [x1, MARK_Y, z1], [x0, MARK_Y, z1], [x0, MARK_Y, z0]] as V3[];
    }
    return Array.from({ length: 73 }, (_, i): V3 => {
      const a = (i / 72) * Math.PI * 2;
      return [zone.cx + Math.cos(a) * zone.r, MARK_Y, zone.cz + Math.sin(a) * zone.r];
    });
  }, [zone]);

  const fill = <meshBasicMaterial color={color} transparent opacity={active ? 0.2 : 0.06} depthWrite={false} toneMapped={false} />;
  return (
    <group>
      {zone.shape === "rect" ? (
        <mesh rotation-x={-Math.PI / 2} position={[(zone.x[0] + zone.x[1]) / 2, MARK_Y, (zone.z[0] + zone.z[1]) / 2]}>
          <planeGeometry args={[zone.x[1] - zone.x[0], zone.z[1] - zone.z[0]]} />
          {fill}
        </mesh>
      ) : (
        <mesh rotation-x={-Math.PI / 2} position={[zone.cx, MARK_Y, zone.cz]}>
          <circleGeometry args={[zone.r, 64]} />
          {fill}
        </mesh>
      )}
      <Line points={outline} color={color} lineWidth={active ? 3 : 1.6} dashed={!active} dashSize={0.35} gapSize={0.22} transparent opacity={active ? 1 : 0.75} />
    </group>
  );
}

const zoneKey = (z: Zone) => `${z.id}:${z.shape === "rect" ? [...z.x, ...z.z].join() : [z.cx, z.cz, z.r].join()}`;

function ZoneMarkers() {
  const zones = useNet((s) => s.derived?.zones ?? EMPTY);
  const current = useNet((s) => s.zoneId);
  const desks = useNet((s) => s.desks);
  return (
    <>
      {zones.map((zn) => (
        <ZoneMarker key={zoneKey(zn)} zone={zn} active={zn.id === current} color={desks[zn.id]?.locked ? LOCKED_COLOR : zn.color} />
      ))}
    </>
  );
}

// Label pemilik meja + pembatas merah transparan saat meja dikunci (mode fokus).
function DeskOverlay({ zone, desk }: { zone: Extract<Zone, { shape: "rect" }>; desk: DeskState }) {
  useT();
  const [x0, x1] = zone.x;
  const [z0, z1] = zone.z;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const h = 1.1;
  const walls: { pos: V3; size: [number, number]; rotY: number }[] = [
    { pos: [cx, h / 2, z0], size: [x1 - x0, h], rotY: 0 },
    { pos: [cx, h / 2, z1], size: [x1 - x0, h], rotY: 0 },
    { pos: [x0, h / 2, cz], size: [z1 - z0, h], rotY: Math.PI / 2 },
    { pos: [x1, h / 2, cz], size: [z1 - z0, h], rotY: Math.PI / 2 },
  ];
  return (
    <group>
      {desk.locked &&
        walls.map((w, i) => (
          <mesh key={i} position={w.pos} rotation-y={w.rotY}>
            <planeGeometry args={w.size} />
            <meshBasicMaterial color={LOCKED_COLOR} transparent opacity={0.18} side={DoubleSide} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      {/* di atas monitor (sisi belakang meja), supaya tidak menumpuk dengan nama orang yang duduk */}
      <Html position={[cx, 1.45, zone.z[0] + 0.2]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <div className={desk.locked ? "desk-label locked" : desk.online ? "desk-label" : "desk-label offline"}>
          {desk.locked ? `🔒 ${t("Fokus")}` : "🪑"} {desk.ownerName}
        </div>
      </Html>
    </group>
  );
}

function DeskOverlays() {
  const desks = useNet((s) => s.desks);
  const zones = useNet((s) => s.derived?.zones ?? EMPTY);
  return (
    <>
      {zones.map((zn) => {
        const d = desks[zn.id];
        return d && zn.shape === "rect" ? <DeskOverlay key={zoneKey(zn)} zone={zn} desk={d} /> : null;
      })}
    </>
  );
}

// ---------- furnitur (+ interaksi editor) ----------

function ItemNode({ item, room, zone }: { item: Item; room: string | null; zone: string | null }) {
  const editing = useEditor((s) => s.active);
  const selected = useEditor((s) => s.selected === item.id);
  const drag = useEditor((s) => (s.drag?.id === item.id ? s.drag : null));
  const x = drag?.x ?? item.x;
  const z = drag?.z ?? item.z;
  const angle = angleOf(item.rot);
  const col = COLLIDERS[item.type];

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    pointerLock.editor = true;
    useEditor.setState({ selected: item.id, drag: { id: item.id, x: item.x, z: item.z } });
    // Lepas di mana pun = selesai menggeser.
    window.addEventListener(
      "pointerup",
      () => {
        const d = useEditor.getState().drag;
        pointerLock.editor = false;
        useEditor.setState({ drag: null });
        if (d && (d.x !== item.x || d.z !== item.z)) moveItem(d.id, d.x, d.z);
      },
      { once: true },
    );
  };

  return (
    <group>
      {col && !drag && (
        <RigidBody key={`${item.x},${item.z},${item.rot}`} type="fixed" colliders={false} position={[item.x, 0, item.z]} rotation={[0, angle, 0]}>
          <CuboidCollider args={col.half} position={col.pos} />
        </RigidBody>
      )}
      <group position={[x, 0, z]} rotation-y={angle} onPointerDown={editing ? onDown : undefined}>
        <Furniture type={item.type} room={room} zone={zone} itemId={item.id} />
      </group>
      {editing && selected && (
        <mesh rotation-x={-Math.PI / 2} position={[x, 0.03, z]}>
          <ringGeometry args={[FOOTPRINT[item.type] - 0.08, FOOTPRINT[item.type], 48]} />
          <meshBasicMaterial color="#2f80ed" toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** Bidang lantai tak terlihat yang menangkap gerakan pointer selama furnitur digeser di editor. */
function DragPlane() {
  const dragging = useEditor((s) => s.drag !== null);
  if (!dragging) return null;
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, 0.02, 0]}
      onPointerMove={(e) => {
        const d = useEditor.getState().drag;
        if (d) useEditor.setState({ drag: { ...d, x: snap(e.point.x), z: snap(e.point.z) } });
      }}
    >
      <planeGeometry args={[W * 4, D * 4]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function Items() {
  const floor = useFloor();
  const zones = useNet((s) => s.derived?.zones ?? EMPTY);
  // Layar & whiteboard milik zona (ruangan/panggung) tempat mereka berada.
  const zoneOf = (it: Item) => zones.find((z) => z.kind !== "desk" && inZone(z, it.x, it.z)) ?? null;
  return (
    <>
      {(floor?.items ?? EMPTY).map((it) => {
        const z = it.type === "screen" || it.type === "whiteboard" ? zoneOf(it) : null;
        return <ItemNode key={it.id} item={it} zone={z?.id ?? null} room={z?.kind === "room" ? z.refId : null} />;
      })}
    </>
  );
}

export function World() {
  const ready = useNet((s) => s.layout !== null);
  return (
    <>
      <Shell />
      {ready && (
        <>
          <RoomFloors />
          <GlassWalls />
          <Doors />
          <Items />
          <ZoneMarkers />
          <DeskOverlays />
          <DragPlane />
        </>
      )}
    </>
  );
}
