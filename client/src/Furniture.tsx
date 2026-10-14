import type { ReactNode } from "react";
import type { ItemType } from "../../shared/layout";
import { PresentationMaterial } from "./ScreenShare";
import { WhiteboardMaterial } from "./WhiteboardView";

// Tampilan furnitur (tanpa fisika), koordinat lokal: sisi depan menghadap +z.
// Collider tiap jenis ada di COLLIDERS (dipakai World).

export const C = {
  wood: "#c69c72",
  woodDark: "#8f6a4a",
  rug: "#e9b8a6",
  sofa: "#7d9bb8",
  monitor: "#2b2d3a",
  screen: "#9ad1ff",
  chair: "#4a5568",
  pot: "#d98e5f",
  leaf: "#6fae6f",
  leafDark: "#4f8f5a",
  white: "#f4f1ec",
  steel: "#b9bec7",
};

type V3 = [number, number, number];

function Box({ size, pos, color, rough = 0.8, shadow = true }: { size: V3; pos: V3; color: string; rough?: number; shadow?: boolean }) {
  return (
    <mesh position={pos} castShadow={shadow} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  );
}

/** Setengah ukuran & posisi collider (lokal). Tanpa entri = bisa dilewati (kursi, karpet, layar dinding). */
export const COLLIDERS: Partial<Record<ItemType, { half: V3; pos: V3 }>> = {
  desk: { half: [0.8, 0.4, 0.45], pos: [0, 0.4, 0] },
  sofa: { half: [1.1, 0.4, 0.45], pos: [0, 0.4, 0] },
  tableLarge: { half: [3, 0.4, 1.1], pos: [0, 0.4, 0] },
  tableSmall: { half: [0.8, 0.4, 0.5], pos: [0, 0.4, 0] },
  coffeeTable: { half: [0.85, 0.25, 0.85], pos: [0, 0.25, 0] },
  plant: { half: [0.32, 0.5, 0.32], pos: [0, 0.5, 0] },
  reception: { half: [1.75, 0.55, 0.4], pos: [0, 0.55, 0] },
  counter: { half: [1.5, 0.5, 0.35], pos: [0, 0.5, 0] },
  fridge: { half: [0.4, 0.95, 0.35], pos: [0, 0.95, 0] },
  bookshelf: { half: [1, 1, 0.2], pos: [0, 1, 0] },
};

/** Radius kira-kira (untuk lingkaran sorotan di editor). */
export const FOOTPRINT: Record<ItemType, number> = {
  desk: 1.1, chair: 0.45, sofa: 1.3, tableLarge: 3.2, tableSmall: 1, coffeeTable: 1, rug: 4, plant: 0.5,
  reception: 1.9, counter: 1.6, fridge: 0.6, bookshelf: 1.1, screen: 2.5, whiteboard: 1.4,
};

function Desk() {
  return (
    <>
      <Box size={[1.6, 0.06, 0.8]} pos={[0, 0.74, 0]} color={C.wood} rough={0.7} />
      {[-0.72, 0.72].map((x) => (
        <Box key={x} size={[0.06, 0.72, 0.7]} pos={[x, 0.36, 0]} color={C.woodDark} />
      ))}
      <Box size={[0.7, 0.42, 0.04]} pos={[0, 1.05, -0.25]} color={C.monitor} />
      <mesh position={[0, 1.05, -0.227]}>
        <planeGeometry args={[0.64, 0.36]} />
        <meshStandardMaterial color={C.screen} emissive={C.screen} emissiveIntensity={0.35} />
      </mesh>
      <Box size={[0.06, 0.16, 0.06]} pos={[0, 0.82, -0.25]} color={C.monitor} shadow={false} />
      <group position={[0, 0, 0.75]}>
        <ChairShape back={0.23} />
      </group>
    </>
  );
}

/** Kursi menghadap +z; sandaran di belakang (−z). `back` = jarak sandaran dari pusat. */
function ChairShape({ back = -0.23 }: { back?: number }) {
  return (
    <>
      <Box size={[0.5, 0.08, 0.5]} pos={[0, 0.45, 0]} color={C.chair} />
      <Box size={[0.5, 0.55, 0.06]} pos={[0, 0.75, back]} color={C.chair} />
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.44]} />
        <meshStandardMaterial color={C.monitor} />
      </mesh>
    </>
  );
}

function Sofa() {
  return (
    <>
      <Box size={[2.2, 0.5, 0.9]} pos={[0, 0.25, 0]} color={C.sofa} rough={0.95} />
      <Box size={[2.2, 0.6, 0.2]} pos={[0, 0.65, -0.35]} color={C.sofa} rough={0.95} />
      {[-1.05, 1.05].map((x) => (
        <Box key={x} size={[0.18, 0.5, 0.9]} pos={[x, 0.45, 0]} color={C.sofa} rough={0.95} />
      ))}
    </>
  );
}

function Table({ w, d }: { w: number; d: number }) {
  return (
    <>
      <Box size={[w, 0.08, d]} pos={[0, 0.76, 0]} color={C.wood} rough={0.7} />
      <Box size={[w * 0.82, 0.72, Math.min(0.3, d * 0.3)]} pos={[0, 0.36, 0]} color={C.woodDark} />
    </>
  );
}

function Plant() {
  return (
    <>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.24, 0.5, 10]} />
        <meshStandardMaterial color={C.pot} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color={C.leaf} flatShading />
      </mesh>
      <mesh position={[0.15, 1.35, 0.05]} castShadow>
        <icosahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial color={C.leafDark} flatShading />
      </mesh>
    </>
  );
}

function Counter() {
  return (
    <>
      <Box size={[3, 0.92, 0.66]} pos={[0, 0.46, 0]} color={C.woodDark} />
      <Box size={[3.06, 0.06, 0.72]} pos={[0, 0.95, 0]} color={C.white} rough={0.4} />
      {/* mesin kopi & wastafel */}
      <Box size={[0.36, 0.42, 0.3]} pos={[-0.9, 1.19, -0.12]} color="#2f3340" rough={0.5} />
      <mesh position={[-0.9, 1.06, 0.08]}>
        <cylinderGeometry args={[0.05, 0.04, 0.1, 12]} />
        <meshStandardMaterial color={C.white} />
      </mesh>
      <Box size={[0.6, 0.04, 0.4]} pos={[0.6, 0.97, 0]} color={C.steel} rough={0.25} shadow={false} />
    </>
  );
}

function Fridge() {
  return (
    <>
      <Box size={[0.8, 1.9, 0.7]} pos={[0, 0.95, 0]} color="#e9edf2" rough={0.35} />
      <Box size={[0.03, 0.5, 0.04]} pos={[0.3, 1.35, 0.37]} color={C.steel} shadow={false} />
      <Box size={[0.03, 0.35, 0.04]} pos={[0.3, 0.6, 0.37]} color={C.steel} shadow={false} />
      <Box size={[0.78, 0.01, 0.01]} pos={[0, 1.05, 0.355]} color="#c8ced6" shadow={false} />
    </>
  );
}

const BOOK_COLORS = ["#c0504d", "#4f81bd", "#9bbb59", "#e0a458", "#8064a2", "#4bacc6"];

function Bookshelf() {
  const books: ReactNode[] = [];
  for (let shelf = 0; shelf < 4; shelf++) {
    let x = -0.88;
    let i = shelf * 3;
    while (x < 0.8) {
      const w = 0.07 + ((i * 37) % 5) * 0.012;
      const h = 0.3 + ((i * 53) % 4) * 0.03;
      books.push(<Box key={`${shelf}-${i}`} size={[w, h, 0.26]} pos={[x + w / 2, 0.08 + shelf * 0.48 + h / 2, 0.02]} color={BOOK_COLORS[i % 6]} shadow={false} />);
      x += w + 0.01;
      i++;
    }
  }
  return (
    <>
      <Box size={[2, 2, 0.06]} pos={[0, 1, -0.17]} color={C.woodDark} />
      {[-0.98, 0.98].map((x) => (
        <Box key={x} size={[0.04, 2, 0.4]} pos={[x, 1, 0]} color={C.woodDark} />
      ))}
      {[0.04, 0.52, 1, 1.48, 1.96].map((y) => (
        <Box key={y} size={[1.96, 0.04, 0.38]} pos={[0, y, 0]} color={C.wood} shadow={false} />
      ))}
      {books}
    </>
  );
}

function Screen({ room }: { room: string | null }) {
  return (
    <>
      <Box size={[4.95, 2.85, 0.06]} pos={[0, 1.75, -0.04]} color="#1b1d26" shadow={false} />
      <mesh position={[0, 1.75, 0]}>
        <planeGeometry args={[4.8, 2.7]} />
        <PresentationMaterial room={room} />
      </mesh>
    </>
  );
}

function Whiteboard({ room }: { room: string | null }) {
  return (
    <>
      <Box size={[2.7, 1.5, 0.05]} pos={[0, 1.5, -0.03]} color={C.steel} rough={0.4} shadow={false} />
      <mesh position={[0, 1.5, 0]}>
        <planeGeometry args={[2.6, 1.4]} />
        <WhiteboardMaterial room={room} />
      </mesh>
      <Box size={[2.6, 0.04, 0.1]} pos={[0, 0.76, 0.04]} color={C.steel} shadow={false} />
    </>
  );
}

export function Furniture({ type, room }: { type: ItemType; room: string | null }) {
  switch (type) {
    case "desk":
      return <Desk />;
    case "chair":
      return <ChairShape />;
    case "sofa":
      return <Sofa />;
    case "tableLarge":
      return <Table w={6} d={2.2} />;
    case "tableSmall":
      return <Table w={1.6} d={1} />;
    case "coffeeTable":
      return (
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.9, 0.9, 0.5, 32]} />
          <meshStandardMaterial color={C.wood} />
        </mesh>
      );
    case "rug":
      return (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]} receiveShadow>
          <circleGeometry args={[4, 48]} />
          <meshStandardMaterial color={C.rug} roughness={1} />
        </mesh>
      );
    case "plant":
      return <Plant />;
    case "reception":
      return (
        <>
          <Box size={[3.5, 1.1, 0.8]} pos={[0, 0.55, 0]} color={C.wood} />
          <Box size={[3.6, 0.06, 0.9]} pos={[0, 1.13, 0]} color={C.woodDark} />
        </>
      );
    case "counter":
      return <Counter />;
    case "fridge":
      return <Fridge />;
    case "bookshelf":
      return <Bookshelf />;
    case "screen":
      return <Screen room={room} />;
    case "whiteboard":
      return <Whiteboard room={room} />;
  }
}
