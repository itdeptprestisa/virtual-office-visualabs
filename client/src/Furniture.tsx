import type { ReactNode } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { ItemType } from "../../shared/layout";
import { PAL } from "./world2d/palette";
import { PresentationMaterial } from "./screen3d";
import { WhiteboardMaterial } from "./whiteboard3d";
import { Ball, Cyl, RBox, Ring, type Mat } from "./shapes3d";
import type { ChairStyle } from "./chairStyle";

// Tampilan furnitur (tanpa fisika), koordinat lokal: sisi depan menghadap +z.
// Collider tiap jenis ada di COLLIDERS (dipakai World). Ukuran luar tiap jenis mengikuti collider-nya.

const PI = Math.PI;
type V3 = [number, number, number];

// Material bersama: makin sedikit jenis, makin sedikit draw call setelah digabung Batched.
const M = {
  oak: { color: "#d8b38a", map: "wood", rough: 0.55 },
  wood: { color: "#c69c72", map: "wood", rough: 0.6 },
  walnut: { color: "#8a6446", map: "wood", rough: 0.6 },
  metal: { color: "#2e3138", metal: 0.6, rough: 0.4 },
  chrome: { color: "#d5d9df", metal: 0.9, rough: 0.22 },
  black: { color: "#24262c", rough: 0.45 },
  white: { color: "#f2f3f5", rough: 0.4 },
  ceramic: { color: "#f8f9fb", rough: 0.12 },
  stone: { color: "#e8e5df", rough: 0.3 },
  steel: { color: "#c3c8cf", metal: 0.7, rough: 0.3 },
  task: { color: PAL.task, rough: 0.95 },
  taskDark: { color: "#33373f", rough: 0.9 },
  chair: { color: PAL.chair, rough: 0.9 },
  chairDark: { color: PAL.chairDark, rough: 0.9 },
  sofa: { color: "#7d9bb8", rough: 0.95 },
  sofaDark: { color: "#62809c", rough: 0.95 },
  pillow: { color: "#f0c987", rough: 0.95 },
  screen: { color: "#9ad1ff", emissive: "#9ad1ff", ei: 0.35, rough: 0.2 },
  glass: { color: "#d6ecff", rough: 0.05, metal: 0.1, opacity: 0.28 },
  leaf: { color: "#5f9e5f", rough: 0.8, double: true },
  leafDark: { color: "#447a4a", rough: 0.8, double: true },
  soil: { color: "#4a3426", rough: 1 },
  pot: { color: "#d98e5f", rough: 0.85 },
  potWhite: { color: "#eceae6", rough: 0.6 },
  gold: { color: "#d8a93b", metal: 0.8, rough: 0.3 },
  paper: { color: "#fbfaf6", rough: 0.9 },
} satisfies Record<string, Mat>;

const col = (color: string, rough = 0.7, extra: Partial<Mat> = {}): Mat => ({ color, rough, ...extra });

export { COLLIDERS, FOOTPRINT } from "../../shared/furniture";

// ---------- kursi ----------

/** Kursi kerja beroda (menghadap +z): kaki bintang 5, tiang hidrolik, dudukan & sandaran berbantal, sandaran tangan. */
function OfficeChair() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation-y={(i * 2 * PI) / 5}>
          <RBox size={[0.045, 0.035, 0.3]} pos={[0, 0.075, 0.15]} rot={[0.08, 0, 0]} m={M.black} />
          <Cyl r={0.028} h={0.035} pos={[0, 0.03, 0.29]} rot={[0, 0, PI / 2]} m={M.black} />
        </group>
      ))}
      <Cyl r={0.05} h={0.06} pos={[0, 0.09, 0]} m={M.black} />
      <Cyl r={0.022} h={0.3} pos={[0, 0.25, 0]} m={M.chrome} />
      <RBox size={[0.22, 0.04, 0.24]} pos={[0, 0.39, 0]} m={M.black} />
      <RBox size={[0.5, 0.08, 0.48]} r={0.035} pos={[0, 0.45, 0.01]} m={M.task} />
      {/* sandaran: tangkai & bantalan, sedikit miring ke belakang */}
      <RBox size={[0.06, 0.3, 0.03]} pos={[0, 0.55, -0.24]} rot={[-0.1, 0, 0]} m={M.black} />
      <RBox size={[0.46, 0.52, 0.07]} r={0.03} pos={[0, 0.82, -0.28]} rot={[-0.12, 0, 0]} m={M.task} />
      <RBox size={[0.36, 0.14, 0.02]} r={0.008} pos={[0, 0.72, -0.235]} rot={[-0.12, 0, 0]} m={M.taskDark} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <RBox size={[0.03, 0.18, 0.04]} pos={[0.26 * s, 0.56, -0.02]} m={M.black} />
          <RBox size={[0.065, 0.03, 0.26]} r={0.012} pos={[0.26 * s, 0.66, 0]} m={M.black} />
        </group>
      ))}
    </>
  );
}

/** Kursi rapat/makan (menghadap +z): 4 kaki logam ramping, dudukan & sandaran berbantal. */
function SideChair() {
  return (
    <>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <Cyl key={`${sx}${sz}`} r={0.017} r2={0.013} h={0.43} pos={[0.2 * sx, 0.215, 0.19 * sz]} m={M.metal} />),
      )}
      <RBox size={[0.46, 0.03, 0.44]} pos={[0, 0.43, 0]} m={M.metal} />
      <RBox size={[0.48, 0.07, 0.46]} r={0.03} pos={[0, 0.47, 0.01]} m={M.chair} />
      {[-1, 1].map((s) => (
        <Cyl key={s} r={0.014} h={0.38} pos={[0.19 * s, 0.64, -0.21]} rot={[-0.1, 0, 0]} m={M.metal} />
      ))}
      <RBox size={[0.46, 0.3, 0.05]} r={0.022} pos={[0, 0.8, -0.235]} rot={[-0.1, 0, 0]} m={M.chairDark} />
    </>
  );
}

const LEATHER = {
  black: { main: col("#1d1a1a", 0.36), dark: col("#121010", 0.4) },
  cognac: { main: col("#7a4325", 0.4), dark: col("#56301b", 0.45) },
};

/**
 * Kursi pimpinan (menghadap +z): sandaran tinggi kulit berbantal bertingkat + sandaran kepala, kaki bintang krom,
 * lengan krom berbantal kulit.
 */
function ExecutiveChair({ leather }: { leather: ChairStyle["leather"] }) {
  const L = LEATHER[leather];
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation-y={(i * 2 * PI) / 5}>
          <RBox size={[0.05, 0.035, 0.34]} pos={[0, 0.08, 0.17]} rot={[0.08, 0, 0]} m={M.chrome} />
          <Cyl r={0.03} h={0.04} pos={[0, 0.032, 0.32]} rot={[0, 0, PI / 2]} m={M.black} />
        </group>
      ))}
      <Cyl r={0.06} h={0.06} pos={[0, 0.1, 0]} m={M.chrome} />
      <Cyl r={0.035} h={0.14} pos={[0, 0.2, 0]} m={M.black} />
      <Cyl r={0.026} h={0.14} pos={[0, 0.33, 0]} m={M.chrome} />
      <RBox size={[0.26, 0.05, 0.28]} pos={[0, 0.39, 0]} m={M.black} />
      {/* dudukan: alas kulit + bantal tebal di atasnya */}
      <RBox size={[0.58, 0.07, 0.56]} r={0.03} pos={[0, 0.43, 0]} m={L.dark} />
      <RBox size={[0.52, 0.07, 0.5]} r={0.03} soft pos={[0, 0.48, 0.02]} m={L.main} />
      {/* tulang sandaran krom */}
      <RBox size={[0.07, 0.32, 0.03]} pos={[0, 0.56, -0.3]} rot={[-0.12, 0, 0]} m={M.chrome} />
      <group position={[0, 1.0, -0.34]} rotation-x={-0.14}>
        <RBox size={[0.56, 0.9, 0.09]} r={0.04} m={L.dark} />
        {[-0.27, -0.06, 0.15].map((y) => (
          <RBox key={y} size={[0.48, 0.2, 0.07]} r={0.033} soft pos={[0, y, 0.06]} m={L.main} />
        ))}
        <RBox size={[0.4, 0.15, 0.07]} r={0.033} soft pos={[0, 0.35, 0.06]} m={L.main} />
      </group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <RBox size={[0.03, 0.22, 0.03]} pos={[0.31 * s, 0.56, 0.08]} m={M.chrome} />
          <RBox size={[0.03, 0.22, 0.03]} pos={[0.31 * s, 0.56, -0.2]} m={M.chrome} />
          <RBox size={[0.085, 0.05, 0.38]} r={0.02} pos={[0.31 * s, 0.69, -0.05]} m={L.main} />
        </group>
      ))}
    </>
  );
}

/** Kursi tamu ruang pimpinan (menghadap +z): rangka krom model "sled", dudukan & sandaran kulit, lengan berbantal. */
function GuestChair({ leather }: { leather: ChairStyle["leather"] }) {
  const L = LEATHER[leather];
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s} position={[0.27 * s, 0, 0]}>
          <RBox size={[0.025, 0.025, 0.58]} pos={[0, 0.0125, 0]} m={M.chrome} />
          <RBox size={[0.025, 0.62, 0.025]} pos={[0, 0.31, 0.27]} m={M.chrome} />
          <RBox size={[0.025, 0.62, 0.025]} pos={[0, 0.31, -0.27]} m={M.chrome} />
          <RBox size={[0.07, 0.04, 0.5]} r={0.015} pos={[0, 0.635, 0]} m={L.main} />
        </group>
      ))}
      <RBox size={[0.5, 0.1, 0.5]} r={0.04} soft pos={[0, 0.44, 0.01]} m={L.main} />
      <RBox size={[0.5, 0.44, 0.09]} r={0.04} soft pos={[0, 0.74, -0.23]} rot={[-0.12, 0, 0]} m={L.main} />
      <RBox size={[0.42, 0.012, 0.012]} r={0} pos={[0, 0.74, -0.18]} rot={[-0.12, 0, 0]} m={L.dark} />
    </>
  );
}

function BarStool() {
  return (
    <>
      <Cyl r={0.2} r2={0.21} h={0.025} seg={24} pos={[0, 0.013, 0]} m={M.chrome} />
      <Cyl r={0.024} h={0.66} pos={[0, 0.36, 0]} m={M.chrome} />
      <Ring r={0.15} tube={0.011} pos={[0, 0.28, 0]} m={M.chrome} />
      {[0, 1, 2].map((i) => (
        <RBox key={i} size={[0.012, 0.012, 0.15]} r={0} pos={[0, 0.28, 0.075]} rot={[0, (i * 2 * PI) / 3, 0]} m={M.chrome} />
      ))}
      <Cyl r={0.19} h={0.03} seg={24} pos={[0, 0.69, 0]} m={M.black} />
      <Cyl r={0.2} r2={0.19} h={0.06} seg={24} pos={[0, 0.73, 0]} m={col("#e8833a", 0.85)} />
    </>
  );
}

// ---------- meja ----------

/** Meja kerja: daun kayu, rangka logam, panel penutup, monitor bertiang, keyboard, mouse, mug; kursi kerja di depan. */
function Desk() {
  return (
    <>
      <RBox size={[1.6, 0.04, 0.8]} r={0.012} pos={[0, 0.74, 0]} m={M.oak} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <RBox size={[0.05, 0.7, 0.05]} pos={[0.74 * s, 0.36, -0.33]} m={M.metal} />
          <RBox size={[0.05, 0.7, 0.05]} pos={[0.74 * s, 0.36, 0.33]} m={M.metal} />
          <RBox size={[0.05, 0.04, 0.7]} pos={[0.74 * s, 0.7, 0]} m={M.metal} />
          <RBox size={[0.06, 0.02, 0.72]} pos={[0.74 * s, 0.01, 0]} m={M.metal} />
        </group>
      ))}
      <RBox size={[1.42, 0.32, 0.015]} r={0.005} pos={[0, 0.52, -0.33]} m={M.white} />
      {/* monitor */}
      <RBox size={[0.24, 0.015, 0.16]} r={0.006} pos={[0, 0.768, -0.26]} m={M.black} />
      <RBox size={[0.045, 0.24, 0.025]} r={0.008} pos={[0, 0.88, -0.28]} m={M.black} />
      <RBox size={[0.7, 0.42, 0.03]} r={0.012} pos={[0, 1.06, -0.255]} m={M.black} />
      <mesh position={[0, 1.07, -0.239]}>
        <planeGeometry args={[0.66, 0.37]} />
        <meshStandardMaterial color={M.screen.color} emissive={M.screen.emissive} emissiveIntensity={M.screen.ei} roughness={0.2} />
      </mesh>
      <RBox size={[0.44, 0.018, 0.14]} r={0.006} pos={[0, 0.769, 0.06]} m={M.black} />
      <RBox size={[0.4, 0.004, 0.1]} r={0} pos={[0, 0.78, 0.06]} m={col("#3a3d45", 0.6)} />
      <RBox size={[0.06, 0.025, 0.1]} r={0.01} pos={[0.33, 0.772, 0.07]} m={M.black} />
      <Cyl r={0.04} h={0.1} pos={[-0.6, 0.81, -0.1]} m={M.ceramic} />
      <group position={[0, 0, 0.75]} rotation-y={PI}>
        <OfficeChair />
      </group>
    </>
  );
}

/** Meja rapat/biasa: daun kayu; meja panjang memakai dua kaki pedestal, meja kecil empat kaki. */
function Table({ w, d }: { w: number; d: number }) {
  const big = w >= 3;
  return (
    <>
      <RBox size={[w, 0.05, d]} r={0.016} pos={[0, 0.745, 0]} m={M.wood} />
      {big
        ? [-1, 1].map((s) => (
            <group key={s} position={[(w / 2 - 0.8) * s, 0, 0]}>
              <RBox size={[0.1, 0.68, d * 0.55]} pos={[0, 0.38, 0]} m={M.metal} />
              <RBox size={[0.14, 0.03, d * 0.72]} pos={[0, 0.015, 0]} m={M.metal} />
              <RBox size={[0.12, 0.03, d * 0.7]} pos={[0, 0.705, 0]} m={M.metal} />
            </group>
          ))
        : [-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => <RBox key={`${sx}${sz}`} size={[0.05, 0.72, 0.05]} pos={[(w / 2 - 0.09) * sx, 0.36, (d / 2 - 0.09) * sz]} m={M.metal} />),
          )}
      {big && <RBox size={[w - 1.8, 0.05, 0.05]} pos={[0, 0.5, 0]} m={M.metal} />}
    </>
  );
}

function CoffeeTable() {
  return (
    <>
      <Cyl r={0.88} h={0.04} seg={40} pos={[0, 0.47, 0]} m={M.walnut} />
      <Cyl r={0.84} h={0.015} seg={40} pos={[0, 0.2, 0]} m={M.walnut} />
      {[0, 1, 2].map((i) => (
        <group key={i} rotation-y={(i * 2 * PI) / 3}>
          <Cyl r={0.022} r2={0.016} h={0.46} pos={[0, 0.23, 0.66]} m={M.metal} />
        </group>
      ))}
      {/* buku & vas di atas meja */}
      <RBox size={[0.3, 0.035, 0.22]} r={0.004} pos={[-0.25, 0.508, 0.1]} rot={[0, 0.3, 0]} m={col("#4f81bd", 0.8)} />
      <RBox size={[0.26, 0.03, 0.2]} r={0.004} pos={[-0.25, 0.54, 0.1]} rot={[0, 0.15, 0]} m={col("#e0a458", 0.8)} />
      <Cyl r={0.06} r2={0.08} h={0.18} pos={[0.3, 0.58, -0.15]} m={M.ceramic} />
      <Ball r={0.07} pos={[0.3, 0.71, -0.15]} scale={[1, 0.8, 1]} m={M.leaf} />
    </>
  );
}

// ---------- sofa & duduk santai ----------

function Sofa() {
  return (
    <>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <Cyl key={`${sx}${sz}`} r={0.025} r2={0.018} h={0.09} pos={[1.0 * sx, 0.045, 0.36 * sz]} m={M.walnut} />),
      )}
      <RBox size={[2.2, 0.22, 0.86]} r={0.05} soft pos={[0, 0.2, 0]} m={M.sofaDark} />
      <RBox size={[2.0, 0.5, 0.16]} r={0.06} soft pos={[0, 0.55, -0.36]} m={M.sofaDark} />
      {[-0.66, 0, 0.66].map((x) => (
        <group key={x}>
          <RBox size={[0.64, 0.16, 0.62]} r={0.06} soft pos={[x, 0.39, 0.1]} m={M.sofa} />
          <RBox size={[0.64, 0.42, 0.18]} r={0.07} soft pos={[x, 0.66, -0.25]} rot={[-0.14, 0, 0]} m={M.sofa} />
        </group>
      ))}
      {[-1, 1].map((s) => (
        <RBox key={s} size={[0.18, 0.5, 0.86]} r={0.07} soft pos={[1.01 * s, 0.34, 0]} m={M.sofaDark} />
      ))}
      <RBox size={[0.36, 0.34, 0.12]} r={0.055} soft pos={[-0.72, 0.62, -0.1]} rot={[-0.2, 0.15, 0.22]} m={M.pillow} />
    </>
  );
}

function BeanBag() {
  return (
    <>
      <Ball r={0.45} seg={20} pos={[0, 0.22, 0.03]} scale={[1.05, 0.5, 1.05]} m={col("#e07a5f", 0.95)} />
      <Ball r={0.36} seg={18} pos={[0, 0.42, -0.16]} scale={[1, 0.85, 0.6]} rot={[-0.3, 0, 0]} m={col("#e07a5f", 0.95)} />
      <Ball r={0.22} seg={14} pos={[0, 0.36, 0.08]} scale={[1.3, 0.3, 1.1]} m={col("#c9654c", 0.95)} />
    </>
  );
}

// ---------- tanaman ----------

/** Lingkaran daun panjang mengarah keluar & ke atas dari satu titik (pot tanaman). */
function Leaves({ n, y, len, tilt, m, m2 = m, phase = 0 }: { n: number; y: number; len: number; tilt: number; m: Mat; m2?: Mat; phase?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const t = tilt + ((i * 37) % 5) * 0.06;
        return (
          <group key={i} position={[0, y, 0]} rotation={[0, phase + (i * 2 * PI) / n, 0]}>
            <group rotation-x={t}>
              <Ball r={1} seg={6} pos={[0, len * 0.55, 0]} scale={[0.075, len * 0.55, 0.02]} m={i % 2 ? m : m2} />
            </group>
          </group>
        );
      })}
    </>
  );
}

function Plant() {
  return (
    <>
      <Cyl r={0.26} r2={0.2} h={0.42} pos={[0, 0.21, 0]} m={M.pot} />
      <Cyl r={0.29} r2={0.27} h={0.06} pos={[0, 0.43, 0]} m={M.pot} />
      <Cyl r={0.26} h={0.02} pos={[0, 0.455, 0]} m={M.soil} />
      <Leaves n={6} y={0.44} len={0.6} tilt={0.55} m={M.leaf} m2={M.leafDark} />
      <Leaves n={5} y={0.46} len={0.7} tilt={0.22} m={M.leafDark} m2={M.leaf} phase={0.4} />
    </>
  );
}

function TreePlant() {
  return (
    <>
      <RBox size={[0.6, 0.5, 0.6]} r={0.04} pos={[0, 0.25, 0]} m={M.potWhite} />
      <Cyl r={0.27} h={0.02} seg={16} pos={[0, 0.5, 0]} m={M.soil} />
      <Cyl r={0.035} r2={0.05} h={1.3} pos={[0, 1.1, 0]} m={col("#7a5a3c", 0.9)} />
      {([[0, 1.95, 0, 0.42], [0.25, 1.6, 0.1, 0.32], [-0.22, 1.7, -0.08, 0.3], [0.05, 1.45, -0.25, 0.26], [-0.1, 1.38, 0.22, 0.24]] as const).map(([x, y, z, r], i) => (
        <Ball key={i} r={r} seg={12} pos={[x, y, z]} scale={[1, 0.85, 1]} m={i % 2 ? M.leafDark : M.leaf} />
      ))}
    </>
  );
}

function HangingPlant() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation-y={(i * 2 * PI) / 3}>
          <Cyl r={0.004} h={0.62} seg={4} pos={[0, 2.78, 0.07]} rot={[0.2, 0, 0]} m={col("#c8b08a", 1)} />
        </group>
      ))}
      <Cyl r={0.16} r2={0.12} h={0.18} seg={16} pos={[0, 2.4, 0]} m={M.potWhite} />
      <Ball r={0.17} seg={12} pos={[0, 2.52, 0]} scale={[1, 0.5, 1]} m={M.leaf} />
      {Array.from({ length: 7 }, (_, i) => (
        <group key={i} rotation-y={(i * 2 * PI) / 7}>
          <Ball r={1} seg={6} pos={[0, 2.3 - (i % 3) * 0.08, 0.17]} scale={[0.05, 0.22 + (i % 3) * 0.06, 0.02]} rot={[0.15, 0, 0]} m={i % 2 ? M.leaf : M.leafDark} />
        </group>
      ))}
    </>
  );
}

// ---------- dapur & pantry ----------

function Counter() {
  const doors = [-1.2, -0.6, 0, 0.6, 1.2];
  return (
    <>
      <RBox size={[2.96, 0.08, 0.56]} r={0.005} pos={[0, 0.04, -0.03]} m={M.black} />
      <RBox size={[3, 0.82, 0.62]} r={0.01} pos={[0, 0.49, -0.02]} m={M.white} />
      {doors.map((x) => (
        <group key={x}>
          <RBox size={[0.58, 0.78, 0.015]} r={0.005} pos={[x, 0.49, 0.295]} m={M.white} />
          <RBox size={[0.14, 0.014, 0.022]} r={0.004} pos={[x, 0.82, 0.31]} m={M.chrome} />
        </group>
      ))}
      <RBox size={[3.06, 0.04, 0.7]} r={0.008} pos={[0, 0.92, 0]} m={M.stone} />
      {/* wastafel & kran */}
      <RBox size={[0.52, 0.006, 0.38]} r={0} pos={[0.6, 0.942, 0.02]} m={M.steel} />
      <RBox size={[0.46, 0.004, 0.32]} r={0} pos={[0.6, 0.946, 0.02]} m={col("#8d939c", 0.25, { metal: 0.7 })} />
      <Cyl r={0.018} h={0.28} pos={[0.6, 1.08, -0.22]} m={M.chrome} />
      <Ring r={0.08} tube={0.016} seg={12} arc={PI} pos={[0.6, 1.22, -0.14]} rot={[0, PI / 2, 0]} m={M.chrome} />
      {/* mesin kopi & cangkir */}
      <RBox size={[0.34, 0.42, 0.3]} r={0.03} pos={[-0.9, 1.15, -0.12]} m={col("#2f3340", 0.4, { metal: 0.3 })} />
      <RBox size={[0.28, 0.04, 0.1]} r={0.01} pos={[-0.9, 1.33, 0.06]} m={col("#2f3340", 0.4, { metal: 0.3 })} />
      <Cyl r={0.03} h={0.05} pos={[-0.9, 1.27, 0.06]} m={M.chrome} />
      <RBox size={[0.22, 0.02, 0.1]} r={0.005} pos={[-0.9, 0.955, 0.08]} m={M.steel} />
      <Cyl r={0.04} r2={0.032} h={0.08} pos={[-0.9, 1.005, 0.08]} m={M.ceramic} />
      <Cyl r={0.04} r2={0.032} h={0.08} pos={[-0.6, 0.98, 0.15]} m={M.ceramic} />
    </>
  );
}

function Fridge() {
  return (
    <>
      <RBox size={[0.8, 1.9, 0.68]} r={0.04} pos={[0, 0.95, -0.01]} m={M.steel} />
      <RBox size={[0.78, 0.008, 0.02]} r={0} pos={[0, 1.2, 0.33]} m={M.black} />
      {[1.55, 0.75].map((y, i) => (
        <Cyl key={y} r={0.014} h={i ? 0.4 : 0.5} pos={[0.32, y, 0.37]} m={M.chrome} />
      ))}
      {[1.55, 0.75].flatMap((y, i) => [-1, 1].map((s) => <RBox key={`${y}${s}`} size={[0.02, 0.02, 0.05]} pos={[0.32, y + s * (i ? 0.18 : 0.23), 0.35]} m={M.chrome} />))}
      <RBox size={[0.14, 0.08, 0.005]} r={0} pos={[-0.22, 1.5, 0.34]} m={col("#1a1d24", 0.2, { emissive: "#6fd3ff", ei: 0.25 })} />
    </>
  );
}

function CoffeeMachine() {
  return (
    <>
      <RBox size={[0.7, 0.75, 0.6]} r={0.015} pos={[0, 0.375, 0]} m={M.walnut} />
      <RBox size={[0.72, 0.03, 0.62]} r={0.008} pos={[0, 0.765, 0]} m={M.stone} />
      <RBox size={[0.5, 0.42, 0.4]} r={0.04} pos={[0, 0.99, -0.05]} m={M.steel} />
      <RBox size={[0.46, 0.08, 0.12]} r={0.02} pos={[0, 1.14, 0.19]} m={M.steel} />
      {[-0.1, 0.1].map((x) => (
        <Cyl key={x} r={0.035} h={0.06} pos={[x, 1.07, 0.2]} m={M.black} />
      ))}
      <RBox size={[0.4, 0.02, 0.14]} r={0.005} pos={[0, 0.79, 0.19]} m={M.black} />
      {[-0.1, 0.1].map((x) => (
        <Cyl key={x} r={0.035} r2={0.03} h={0.07} pos={[x, 0.835, 0.19]} m={M.ceramic} />
      ))}
      <Cyl r={0.08} r2={0.06} h={0.18} pos={[0.12, 1.29, -0.1]} m={col("#3b2a20", 0.3, { opacity: 0.85 })} />
      <RBox size={[0.12, 0.06, 0.005]} r={0} pos={[-0.12, 1.08, 0.152]} m={col("#1a1d24", 0.2, { emissive: "#7affb0", ei: 0.3 })} />
    </>
  );
}

function Vending() {
  const colors = ["#e74c3c", "#f1c40f", "#3498db", "#2ecc71", "#e67e22"];
  return (
    <>
      <RBox size={[1, 2, 0.8]} r={0.04} pos={[0, 1, 0]} m={col("#d63c41", 0.45)} />
      <RBox size={[0.66, 1.42, 0.02]} r={0.01} pos={[-0.12, 1.18, 0.395]} m={col("#1c2433", 0.3)} />
      {[0, 1, 2, 3, 4].flatMap((row) =>
        [0, 1, 2, 3].map((c) => (
          <RBox key={`${row}${c}`} size={[0.11, 0.17, 0.08]} r={0.01} pos={[-0.38 + c * 0.17, 0.62 + row * 0.27, 0.36]} m={col(colors[(row + c) % 5], 0.5)} />
        )),
      )}
      {[0, 1, 2, 3, 4].map((row) => (
        <RBox key={row} size={[0.64, 0.01, 0.06]} r={0} pos={[-0.12, 0.53 + row * 0.27, 0.37]} m={M.steel} />
      ))}
      <mesh position={[-0.12, 1.18, 0.41]}>
        <planeGeometry args={[0.64, 1.4]} />
        <meshStandardMaterial color="#d6ecff" roughness={0.05} metalness={0.1} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      {/* panel tombol, celah koin, laci ambil */}
      <RBox size={[0.18, 0.5, 0.02]} r={0.01} pos={[0.37, 1.3, 0.4]} m={M.black} />
      <RBox size={[0.12, 0.08, 0.005]} r={0} pos={[0.37, 1.46, 0.412]} m={col("#0e1a12", 0.2, { emissive: "#3dd36b", ei: 0.4 })} />
      <RBox size={[0.66, 0.2, 0.04]} r={0.01} pos={[-0.12, 0.27, 0.39]} m={M.black} />
    </>
  );
}

function SnackShelf() {
  const colors = ["#e74c3c", "#f1c40f", "#3498db", "#e67e22", "#9b59b6", "#2ecc71"];
  return (
    <>
      {[-1, 1].map((s) => (
        <RBox key={s} size={[0.03, 1.8, 0.4]} r={0.008} pos={[0.585 * s, 0.9, 0]} m={M.metal} />
      ))}
      <RBox size={[1.2, 1.8, 0.02]} r={0} pos={[0, 0.9, -0.19]} m={M.white} />
      {[0.08, 0.5, 0.92, 1.34, 1.76].map((y, si) => (
        <group key={y}>
          <RBox size={[1.17, 0.025, 0.38]} r={0.005} pos={[0, y, 0]} m={M.white} />
          {si < 4 &&
            [0, 1, 2, 3, 4, 5].map((i) => (
              <RBox key={i} size={[0.14, 0.2 + ((i + si) % 3) * 0.04, 0.12 + (i % 2) * 0.06]} r={0.01} pos={[-0.45 + i * 0.18, y + 0.12 + ((i + si) % 3) * 0.02, 0.05]} m={col(colors[(i + si * 2) % 6], 0.6)} />
            ))}
        </group>
      ))}
    </>
  );
}

function Dispenser() {
  return (
    <>
      <RBox size={[0.34, 0.95, 0.34]} r={0.03} pos={[0, 0.475, 0]} m={M.white} />
      <RBox size={[0.24, 0.18, 0.04]} r={0.01} pos={[0, 0.72, 0.16]} m={col("#d5dbe2", 0.4)} />
      {([[-0.06, "#3a7bd5"], [0.06, "#e74c3c"]] as const).map(([x, c]) => (
        <RBox key={x} size={[0.04, 0.05, 0.05]} r={0.01} pos={[x, 0.77, 0.19]} m={col(c, 0.4)} />
      ))}
      <RBox size={[0.2, 0.02, 0.08]} r={0.005} pos={[0, 0.62, 0.17]} m={M.steel} />
      <Cyl r={0.04} h={0.08} pos={[0, 0.99, 0]} m={col("#3a7bd5", 0.2, { opacity: 0.6 })} />
      <Cyl r={0.14} h={0.4} seg={20} pos={[0, 1.22, 0]} m={col("#7fb8ec", 0.08, { opacity: 0.45 })} />
      <Ball r={0.14} seg={16} pos={[0, 1.02, 0]} scale={[1, 0.45, 1]} m={col("#7fb8ec", 0.08, { opacity: 0.45 })} />
    </>
  );
}

// ---------- rak & dinding ----------

const BOOK_COLORS = ["#a8433f", "#3e6c9e", "#7f9a4a", "#c48c45", "#6a5490", "#3d8fa3", "#d9d2c3", "#2f3a4f"];

function Bookshelf() {
  const books: ReactNode[] = [];
  for (let shelf = 0; shelf < 4; shelf++) {
    let x = -0.9;
    let i = shelf * 5;
    while (x < 0.75) {
      const w = 0.05 + ((i * 37) % 5) * 0.012;
      const h = 0.26 + ((i * 53) % 5) * 0.03;
      const y = 0.08 + shelf * 0.48;
      if ((i * 7) % 11 === 3) {
        // buku tidur bertumpuk
        books.push(<RBox key={`${shelf}-${i}`} size={[0.24, 0.05, 0.22]} r={0} pos={[x + 0.12, y + 0.025, 0.02]} m={col(BOOK_COLORS[i % 8], 0.8)} />);
        books.push(<RBox key={`${shelf}-${i}b`} size={[0.22, 0.04, 0.2]} r={0} pos={[x + 0.12, y + 0.07, 0.02]} m={col(BOOK_COLORS[(i + 3) % 8], 0.8)} />);
        x += 0.26;
      } else {
        books.push(<RBox key={`${shelf}-${i}`} size={[w, h, 0.24]} r={0} pos={[x + w / 2, y + h / 2, 0.02]} m={col(BOOK_COLORS[i % 8], 0.8)} />);
        x += w + 0.006;
      }
      i++;
    }
  }
  return (
    <>
      <RBox size={[2, 2, 0.03]} r={0} pos={[0, 1, -0.185]} m={M.walnut} />
      {[-0.98, 0.98].map((x) => (
        <RBox key={x} size={[0.04, 2, 0.4]} r={0.008} pos={[x, 1, 0]} m={M.walnut} />
      ))}
      {[0.04, 0.52, 1, 1.48, 1.98].map((y) => (
        <RBox key={y} size={[1.96, 0.035, 0.38]} r={0.006} pos={[0, y, 0]} m={M.wood} />
      ))}
      {books}
      <Cyl r={0.06} r2={0.05} h={0.1} pos={[0.86, 1.57, 0.03]} m={M.pot} />
      <Ball r={0.08} pos={[0.86, 1.68, 0.03]} m={M.leaf} />
    </>
  );
}

function MagazineRack() {
  const colors = ["#e07a5f", "#3d405b", "#81b29a", "#f2cc8f"];
  return (
    <>
      {[-1, 1].map((s) => (
        <RBox key={s} size={[0.03, 1, 0.3]} r={0.008} pos={[0.385 * s, 0.5, 0]} m={M.walnut} />
      ))}
      <RBox size={[0.8, 1, 0.02]} r={0} pos={[0, 0.5, -0.14]} m={M.walnut} />
      {[0.15, 0.45, 0.75].map((y, ti) => (
        <group key={y}>
          <RBox size={[0.76, 0.02, 0.14]} r={0} pos={[0, y, 0.05]} rot={[0.3, 0, 0]} m={M.wood} />
          <RBox size={[0.76, 0.06, 0.012]} r={0} pos={[0, y + 0.03, 0.12]} rot={[0.3, 0, 0]} m={M.wood} />
          {[-0.2, 0.08].map((x, i) => (
            <RBox key={x} size={[0.24, 0.3, 0.008]} r={0} pos={[x, y + 0.16, 0.04]} rot={[-0.3, 0, 0]} m={col(colors[(ti + i) % 4], 0.5)} />
          ))}
        </group>
      ))}
    </>
  );
}

function PrizeShelf() {
  return (
    <>
      {[-1, 1].map((s) => (
        <RBox key={s} size={[0.04, 2, 0.5]} r={0.01} pos={[0.98 * s, 1, 0]} m={M.walnut} />
      ))}
      <RBox size={[2, 2, 0.03]} r={0} pos={[0, 1, -0.235]} m={M.walnut} />
      {[0.05, 0.55, 1.05, 1.55, 1.98].map((y) => (
        <RBox key={y} size={[1.96, 0.04, 0.48]} r={0.008} pos={[0, y, 0]} m={M.wood} />
      ))}
      {/* piala */}
      {[-0.6, 0, 0.6].map((x, i) => (
        <group key={x} position={[x, 1.57, 0]} scale={1 - i * 0.12}>
          <RBox size={[0.14, 0.05, 0.14]} r={0.01} pos={[0, 0.025, 0]} m={M.black} />
          <Cyl r={0.02} h={0.12} pos={[0, 0.11, 0]} m={M.gold} />
          <Cyl r={0.09} r2={0.04} h={0.14} seg={16} pos={[0, 0.24, 0]} m={M.gold} />
        </group>
      ))}
      {/* boneka beruang */}
      {[-0.55, 0.55].map((x, i) => (
        <group key={x} position={[x, 1.07, 0]}>
          <Ball r={0.14} seg={12} pos={[0, 0.14, 0]} scale={[1, 1.1, 0.9]} m={col(i ? "#c98b5e" : "#f2a7c3", 0.95)} />
          <Ball r={0.1} seg={12} pos={[0, 0.34, 0.02]} m={col(i ? "#c98b5e" : "#f2a7c3", 0.95)} />
          {[-1, 1].map((s) => (
            <Ball key={s} r={0.04} pos={[0.07 * s, 0.43, 0]} m={col(i ? "#c98b5e" : "#f2a7c3", 0.95)} />
          ))}
        </group>
      ))}
      <RBox size={[0.3, 0.3, 0.3]} r={0.02} pos={[0, 1.22, 0]} m={col("#4f81bd", 0.6)} />
      <RBox size={[0.32, 0.04, 0.06]} r={0} pos={[0, 1.22, 0.14]} m={col("#e74c3c", 0.6)} />
      {[-0.7, -0.35, 0.35, 0.7].map((x, i) => (
        <Ball key={x} r={0.1} seg={12} pos={[x, 0.67, 0.05]} m={col(["#e74c3c", "#f1c40f", "#3498db", "#2ecc71"][i], 0.4)} />
      ))}
    </>
  );
}

function WallShelf() {
  return (
    <>
      <RBox size={[1.2, 0.04, 0.25]} r={0.008} pos={[0, 1.5, 0.13]} m={M.walnut} />
      {[-0.45, 0.45].map((x) => (
        <RBox key={x} size={[0.02, 0.14, 0.18]} r={0} pos={[x, 1.42, 0.1]} m={M.metal} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <RBox key={i} size={[0.04, 0.2 + (i % 2) * 0.03, 0.16]} r={0} pos={[-0.45 + i * 0.045, 1.62 + (i % 2) * 0.015, 0.13]} m={col(BOOK_COLORS[i * 2], 0.8)} />
      ))}
      <Cyl r={0.06} r2={0.05} h={0.1} pos={[0.1, 1.57, 0.13]} m={M.potWhite} />
      <Ball r={0.08} pos={[0.1, 1.67, 0.13]} m={M.leaf} />
      <RBox size={[0.16, 0.12, 0.12]} r={0.01} pos={[0.42, 1.58, 0.13]} m={M.oak} />
    </>
  );
}

function Frame() {
  return (
    <>
      <RBox size={[1.2, 0.8, 0.04]} r={0.008} pos={[0, 1.7, 0.02]} m={M.walnut} />
      <RBox size={[1.08, 0.68, 0.01]} r={0} pos={[0, 1.7, 0.042]} m={M.paper} />
      {/* pemandangan sederhana: langit, bukit, matahari */}
      <RBox size={[0.9, 0.5, 0.004]} r={0} pos={[0, 1.7, 0.048]} m={col("#a9d3ee", 0.9)} />
      <Ball r={0.3} seg={16} pos={[-0.2, 1.45, 0.05]} scale={[1.2, 0.5, 0.01]} m={col("#7fb069", 0.9)} />
      <Ball r={0.3} seg={16} pos={[0.22, 1.45, 0.051]} scale={[1, 0.38, 0.01]} m={col("#5b8c51", 0.9)} />
      <Ball r={0.06} seg={12} pos={[0.28, 1.84, 0.052]} scale={[1, 1, 0.1]} m={col("#f6c453", 0.9)} />
    </>
  );
}

function Poster() {
  return (
    <>
      <RBox size={[1, 1.4, 0.025]} r={0.005} pos={[0, 1.6, 0.015]} m={M.black} />
      <RBox size={[0.92, 1.32, 0.005]} r={0} pos={[0, 1.6, 0.03]} m={col("#f28b82", 0.8)} />
      <Ball r={0.22} seg={16} pos={[0, 1.78, 0.034]} scale={[1, 1, 0.05]} m={col("#fff4e0", 0.8)} />
      {[1.38, 1.3, 1.22].map((y, i) => (
        <RBox key={y} size={[0.6 - i * 0.12, 0.04, 0.004]} r={0} pos={[0, y, 0.034]} m={col("#ffffff", 0.8)} />
      ))}
    </>
  );
}

function NoticeBoard() {
  const notes: [number, number, string, number][] = [[-0.5, 1.68, "#fff59d", 0.08], [-0.15, 1.62, "#a5d6a7", -0.06], [0.25, 1.7, "#90caf9", 0.05], [0.55, 1.45, "#f8bbd0", -0.1], [-0.4, 1.3, "#ffffff", 0.04], [0.1, 1.32, "#ffe0b2", -0.03]];
  return (
    <>
      <RBox size={[1.6, 1, 0.05]} r={0.01} pos={[0, 1.5, 0.025]} m={M.walnut} />
      <RBox size={[1.5, 0.9, 0.01]} r={0} pos={[0, 1.5, 0.052]} m={col("#c9a074", 1)} />
      {notes.map(([x, y, c, r]) => (
        <group key={`${x}${y}`}>
          <RBox size={[0.24, 0.24, 0.003]} r={0} pos={[x, y, 0.06]} rot={[0, 0, r]} m={col(c, 0.9)} />
          <Ball r={0.015} pos={[x, y + 0.09, 0.066]} m={col("#d63c41", 0.4)} />
        </group>
      ))}
    </>
  );
}

function Clock() {
  const mins = (new Date().getHours() % 12) * 30 + new Date().getMinutes() * 0.5;
  return (
    <group position={[0, 2.2, 0.03]}>
      <Ring r={0.18} tube={0.022} seg={32} rot={[0, 0, 0]} m={M.black} />
      <Cyl r={0.17} h={0.02} seg={32} rot={[PI / 2, 0, 0]} m={M.white} />
      {Array.from({ length: 12 }, (_, i) => (
        <group key={i} rotation-z={(i * PI) / 6}>
          <RBox size={[0.012, i % 3 ? 0.02 : 0.04, 0.004]} r={0} pos={[0, 0.14, 0.012]} m={M.black} />
        </group>
      ))}
      <group rotation-z={(-mins * PI) / 180}>
        <RBox size={[0.012, 0.09, 0.004]} r={0} pos={[0, 0.04, 0.016]} m={M.black} />
      </group>
      <group rotation-z={-((new Date().getMinutes() * 6) * PI) / 180}>
        <RBox size={[0.008, 0.13, 0.004]} r={0} pos={[0, 0.06, 0.018]} m={M.black} />
      </group>
    </group>
  );
}

function Window() {
  return (
    <>
      <RBox size={[3, 1.4, 0.06]} r={0.01} pos={[0, 1.6, 0.0]} m={M.white} />
      <mesh position={[0, 1.6, 0.032]}>
        <planeGeometry args={[2.88, 1.28]} />
        <meshStandardMaterial color="#bfe1ff" roughness={0.05} metalness={0.2} emissive="#cfe8ff" emissiveIntensity={0.25} />
      </mesh>
      {[-0.5, 0.5].map((x) => (
        <RBox key={x} size={[0.04, 1.3, 0.04]} r={0.005} pos={[x * 1.92, 1.6, 0.04]} m={M.white} />
      ))}
      <RBox size={[2.9, 0.04, 0.04]} r={0.005} pos={[0, 1.6, 0.04]} m={M.white} />
      <RBox size={[3.1, 0.04, 0.16]} r={0.008} pos={[0, 0.88, 0.06]} m={M.white} />
    </>
  );
}

function Tv() {
  return (
    <>
      <RBox size={[2, 1.15, 0.05]} r={0.012} pos={[0, 1.6, 0.03]} m={M.black} />
      <mesh position={[0, 1.6, 0.056]}>
        <planeGeometry args={[1.92, 1.07]} />
        <meshStandardMaterial color="#0d1117" roughness={0.12} metalness={0.3} />
      </mesh>
      <RBox size={[0.04, 0.012, 0.005]} r={0} pos={[0, 1.04, 0.057]} m={col("#ff4d4d", 0.3, { emissive: "#ff4d4d", ei: 0.6 })} />
    </>
  );
}

function LogoBoard() {
  return (
    <>
      <RBox size={[2.8, 0.8, 0.06]} r={0.02} pos={[0, 2, 0.04]} m={col("#2b3a67", 0.4)} />
      <RBox size={[2.66, 0.66, 0.01]} r={0} pos={[0, 2, 0.072]} m={col("#33467a", 0.35)} />
      {[-1, 1].map((s) => (
        <Cyl key={s} r={0.025} h={0.06} pos={[1.3 * s, 2.32, 0.08]} rot={[PI / 2, 0, 0]} m={M.chrome} />
      ))}
    </>
  );
}

// ---------- ruang rapat & aula ----------

function Screen({ zone, itemId }: { zone: string | null; itemId: string }) {
  return (
    <>
      <RBox size={[4.95, 2.85, 0.06]} r={0.02} pos={[0, 1.75, -0.04]} m={col("#1b1d26", 0.4)} />
      <mesh position={[0, 1.75, 0]}>
        <planeGeometry args={[4.8, 2.7]} />
        <PresentationMaterial zone={zone} itemId={itemId} />
      </mesh>
    </>
  );
}

function Whiteboard({ room }: { room: string | null }) {
  return (
    <>
      <RBox size={[2.7, 1.5, 0.04]} r={0.012} pos={[0, 1.5, -0.03]} m={M.steel} />
      <mesh position={[0, 1.5, 0]}>
        <planeGeometry args={[2.6, 1.4]} />
        <WhiteboardMaterial room={room} />
      </mesh>
      <RBox size={[2.4, 0.03, 0.09]} r={0.008} pos={[0, 0.78, 0.04]} m={M.steel} />
      {(["#1f6feb", "#d63c41", "#2e7d32"] as const).map((c, i) => (
        <Cyl key={c} r={0.012} h={0.13} pos={[-0.9 + i * 0.07, 0.805, 0.05]} rot={[0, 0, PI / 2]} m={col(c, 0.5)} />
      ))}
      <RBox size={[0.14, 0.05, 0.05]} r={0.01} pos={[0.8, 0.815, 0.05]} m={M.black} />
    </>
  );
}

function Podium() {
  return (
    <>
      <RBox size={[0.62, 1.0, 0.46]} r={0.02} pos={[0, 0.52, 0]} m={M.walnut} />
      <RBox size={[0.5, 0.75, 0.012]} r={0.004} pos={[0, 0.55, 0.232]} m={M.oak} />
      <RBox size={[0.66, 0.04, 0.5]} r={0.01} pos={[0, 0.02, 0]} m={M.black} />
      <RBox size={[0.7, 0.05, 0.5]} r={0.012} pos={[0, 1.08, 0.02]} rot={[-0.35, 0, 0]} m={M.oak} />
      <RBox size={[0.3, 0.004, 0.22]} r={0} pos={[-0.06, 1.11, 0.03]} rot={[-0.35, 0, 0]} m={M.paper} />
      {/* mikrofon leher angsa */}
      <Cyl r={0.012} h={0.3} pos={[0.2, 1.24, 0.1]} rot={[0.5, 0, 0]} m={M.black} />
      <Cyl r={0.022} r2={0.015} h={0.08} pos={[0.2, 1.39, 0.18]} rot={[1.1, 0, 0]} m={M.black} />
    </>
  );
}

let liftTex: CanvasTexture | null = null;
/** Tulisan "LIFT" di atap ruang lift (terbaca dari kamera atas), dibuat sekali. */
function liftLabel() {
  if (liftTex) return liftTex;
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.canvas.width = 512;
  ctx.canvas.height = 256;
  ctx.fillStyle = "#2f80ed";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 150px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("LIFT", 256, 138);
  liftTex = new CanvasTexture(ctx.canvas);
  liftTex.colorSpace = SRGBColorSpace;
  return liftTex;
}

/** Ruang lift berbentuk kotak (pintu di depan, +z); badannya memanjang ke belakang sampai dinding. */
function Elevator() {
  return (
    <>
      <RBox size={[2.8, 3, 2.5]} r={0.03} pos={[0, 1.5, -1.25]} m={col("#cfd5dd", 0.35)} />
      <RBox size={[2.9, 0.12, 2.6]} r={0.02} pos={[0, 3.06, -1.25]} m={col("#aab2bd", 0.4)} />
      {/* atap bertulisan LIFT; tulisan menghadap utara dunia seperti tulisan lantai lain (lift diputar 180°) */}
      <mesh position={[0, 3.13, -1.25]} rotation={[-PI / 2, 0, PI]}>
        <planeGeometry args={[2.4, 1.2]} />
        <meshBasicMaterial map={liftLabel()} toneMapped={false} />
      </mesh>
      <RBox size={[1.9, 2.55, 0.08]} r={0.01} pos={[0, 1.27, 0.02]} m={M.steel} />
      <RBox size={[1.8, 2.45, 0.06]} r={0} pos={[0, 1.22, 0.03]} m={col("#7d8794", 0.4)} />
      {[-1, 1].map((s) => (
        <RBox key={s} size={[0.78, 2.3, 0.04]} r={0.006} pos={[0.4 * s, 1.17, 0.07]} m={col("#b6bec8", 0.18, { metal: 0.6 })} />
      ))}
      {/* penunjuk lantai & tombol panggil */}
      <RBox size={[0.74, 0.28, 0.03]} r={0.008} pos={[0, 2.68, 0.06]} m={M.black} />
      <mesh position={[0, 2.68, 0.076]}>
        <planeGeometry args={[0.66, 0.2]} />
        <meshStandardMaterial color="#111" emissive="#ff8a3d" emissiveIntensity={0.6} />
      </mesh>
      <RBox size={[0.14, 0.26, 0.02]} r={0.008} pos={[1.15, 1.15, 0.06]} m={M.steel} />
      {[0.05, -0.05].map((y) => (
        <Cyl key={y} r={0.03} h={0.02} pos={[1.15, 1.15 + y, 0.075]} rot={[PI / 2, 0, 0]} m={col("#e0e4ea", 0.3, { emissive: "#7ab8ff", ei: 0.5 })} />
      ))}
    </>
  );
}

function Reception() {
  return (
    <>
      <RBox size={[3.5, 1.05, 0.75]} r={0.03} pos={[0, 0.525, 0]} m={M.oak} />
      <RBox size={[3.3, 0.7, 0.015]} r={0.004} pos={[0, 0.5, 0.378]} m={M.white} />
      <RBox size={[3.3, 0.03, 0.01]} r={0} pos={[0, 0.88, 0.386]} m={M.gold} />
      <RBox size={[3.6, 0.05, 0.4]} r={0.012} pos={[0, 1.1, 0.25]} m={M.stone} />
      <RBox size={[3.5, 0.06, 0.04]} r={0} pos={[0, 0.03, 0.35]} m={M.black} />
      {/* monitor & lampu meja menghadap petugas (−z) */}
      <group position={[-0.8, 1.05, -0.15]} rotation-y={PI}>
        <RBox size={[0.2, 0.015, 0.14]} r={0.006} pos={[0, 0.01, 0]} m={M.black} />
        <RBox size={[0.04, 0.2, 0.02]} r={0.006} pos={[0, 0.11, -0.02]} m={M.black} />
        <RBox size={[0.56, 0.34, 0.025]} r={0.01} pos={[0, 0.3, 0]} m={M.black} />
      </group>
      <Cyl r={0.05} h={0.02} pos={[0.6, 1.135, 0.25]} m={M.gold} />
      <Ball r={0.045} seg={12} pos={[0.6, 1.155, 0.25]} scale={[1, 0.7, 1]} m={M.gold} />
    </>
  );
}

// ---------- kamar mandi & musala ----------

function ToiletStall() {
  return (
    <>
      {[-0.88, 0.88].map((x) => (
        <RBox key={x} size={[0.04, 1.85, 1.9]} r={0.012} pos={[x, 1.1, 0]} m={col("#9cb4cc", 0.45)} />
      ))}
      {[-0.88, 0.88].flatMap((x) => [-0.8, 0.8].map((z) => <Cyl key={`${x}${z}`} r={0.018} h={0.17} pos={[x, 0.085, z]} m={M.chrome} />))}
      {/* kloset duduk */}
      <Cyl r={0.12} r2={0.15} h={0.3} seg={16} pos={[0, 0.15, -0.55]} m={M.ceramic} />
      <Ball r={0.2} seg={18} pos={[0, 0.33, -0.5]} scale={[0.95, 0.5, 1.25]} m={M.ceramic} />
      <Ring r={0.165} tube={0.028} seg={20} pos={[0, 0.42, -0.5]} scale={[0.95, 1.25, 1]} m={M.white} />
      <RBox size={[0.34, 0.42, 0.03]} r={0.012} pos={[0, 0.62, -0.74]} rot={[-0.15, 0, 0]} m={M.white} />
      <RBox size={[0.44, 0.38, 0.17]} r={0.03} pos={[0, 0.66, -0.87]} m={M.ceramic} />
      <Cyl r={0.025} h={0.012} pos={[0, 0.856, -0.87]} m={M.chrome} />
      {/* tisu */}
      <Cyl r={0.055} h={0.11} seg={12} pos={[0.82, 0.75, -0.3]} rot={[0, 0, PI / 2]} m={M.paper} />
    </>
  );
}

function Sink() {
  return (
    <>
      <RBox size={[0.8, 0.72, 0.44]} r={0.015} pos={[0, 0.42, -0.02]} m={M.walnut} />
      <RBox size={[0.9, 0.05, 0.5]} r={0.01} pos={[0, 0.805, 0]} m={M.stone} />
      <Cyl r={0.2} r2={0.15} h={0.12} seg={24} pos={[0, 0.89, 0.03]} m={M.ceramic} />
      <Cyl r={0.17} h={0.005} seg={24} pos={[0, 0.948, 0.03]} m={col("#d8dee6", 0.15)} />
      <Cyl r={0.018} h={0.24} pos={[0, 0.95, -0.18]} m={M.chrome} />
      <RBox size={[0.03, 0.025, 0.14]} r={0.008} pos={[0, 1.065, -0.12]} m={M.chrome} />
      <RBox size={[0.015, 0.06, 0.015]} r={0} pos={[0.04, 1.06, -0.19]} m={M.chrome} />
      <RBox size={[0.72, 0.84, 0.025]} r={0.01} pos={[0, 1.62, -0.235]} m={M.black} />
      <mesh position={[0, 1.62, -0.221]}>
        <planeGeometry args={[0.66, 0.78]} />
        <meshStandardMaterial color="#e3eef6" roughness={0.04} metalness={0.9} />
      </mesh>
    </>
  );
}

/** Sajadah: arah kiblat = +z (ujung bermotif mihrab). */
function PrayerMat() {
  return (
    <group rotation-x={-PI / 2}>
      <mesh position={[0, 0, 0.007]} receiveShadow>
        <planeGeometry args={[0.74, 1.24]} />
        <meshStandardMaterial color="#c9a227" roughness={1} />
      </mesh>
      <mesh position={[0, 0, 0.008]} receiveShadow>
        <planeGeometry args={[0.64, 1.14]} />
        <meshStandardMaterial color="#2e7d5b" roughness={1} />
      </mesh>
      <mesh position={[0, 0, 0.0085]} receiveShadow>
        <planeGeometry args={[0.5, 0.9]} />
        <meshStandardMaterial color="#25694c" roughness={1} />
      </mesh>
      <mesh position={[0, -0.38, 0.009]}>
        <circleGeometry args={[0.18, 24, PI, PI]} />
        <meshStandardMaterial color="#c9a227" roughness={1} />
      </mesh>
    </group>
  );
}

// ---------- kantor kecil ----------

function FloorLamp() {
  return (
    <>
      <Cyl r={0.16} r2={0.17} h={0.03} seg={24} pos={[0, 0.015, 0]} m={M.metal} />
      <Cyl r={0.013} h={1.42} pos={[0, 0.74, 0]} m={M.metal} />
      <Cyl r={0.14} r2={0.22} h={0.3} seg={24} open pos={[0, 1.55, 0]} m={col("#f3e2b8", 0.9, { emissive: "#fff1c9", ei: 0.45, double: true })} />
      <Ball r={0.05} pos={[0, 1.48, 0]} m={col("#fff8e6", 0.3, { emissive: "#fff1c9", ei: 1.2 })} />
    </>
  );
}

function Printer() {
  return (
    <>
      <RBox size={[0.68, 0.45, 0.56]} r={0.015} pos={[0, 0.225, 0]} m={col("#5f6672", 0.5)} />
      <RBox size={[0.3, 0.012, 0.012]} r={0} pos={[0, 0.3, 0.282]} m={M.black} />
      <RBox size={[0.7, 0.36, 0.58]} r={0.03} pos={[0, 0.63, 0]} m={col("#e6e8ec", 0.45)} />
      <RBox size={[0.66, 0.06, 0.54]} r={0.02} pos={[0, 0.84, 0]} m={col("#cfd3da", 0.45)} />
      <RBox size={[0.4, 0.02, 0.24]} r={0.005} pos={[0, 0.6, 0.33]} rot={[0.15, 0, 0]} m={col("#cfd3da", 0.45)} />
      <RBox size={[0.3, 0.004, 0.2]} r={0} pos={[0, 0.615, 0.33]} rot={[0.15, 0, 0]} m={M.paper} />
      <RBox size={[0.18, 0.08, 0.02]} r={0.008} pos={[0.2, 0.76, 0.29]} rot={[-0.4, 0, 0]} m={M.black} />
      <RBox size={[0.1, 0.05, 0.004]} r={0} pos={[0.2, 0.765, 0.302]} rot={[-0.4, 0, 0]} m={col("#0e1a2a", 0.2, { emissive: "#5aa9ff", ei: 0.5 })} />
    </>
  );
}

function Bin() {
  return (
    <>
      <Cyl r={0.17} r2={0.14} h={0.4} seg={20} open pos={[0, 0.2, 0]} m={col("#6b7280", 0.45, { metal: 0.4, double: true })} />
      <Cyl r={0.14} h={0.01} seg={20} pos={[0, 0.005, 0]} m={col("#6b7280", 0.45, { metal: 0.4 })} />
      <Ring r={0.17} tube={0.008} seg={20} pos={[0, 0.4, 0]} m={col("#6b7280", 0.45, { metal: 0.4 })} />
      <Ball r={0.06} pos={[0.03, 0.3, 0.02]} m={M.paper} />
    </>
  );
}

// ---------- karpet ----------

function RugRound() {
  return (
    <group rotation-x={-PI / 2}>
      <mesh position={[0, 0, 0.006]} receiveShadow>
        <circleGeometry args={[4, 48]} />
        <meshStandardMaterial color="#d9a593" roughness={1} />
      </mesh>
      <mesh position={[0, 0, 0.007]} receiveShadow>
        <circleGeometry args={[3.75, 48]} />
        <meshStandardMaterial color="#e9b8a6" roughness={1} />
      </mesh>
      <mesh position={[0, 0, 0.008]} receiveShadow>
        <ringGeometry args={[2.6, 2.72, 48]} />
        <meshStandardMaterial color="#d9a593" roughness={1} />
      </mesh>
    </group>
  );
}

function RugRect({ w, d, base, edge }: { w: number; d: number; base: string; edge: string }) {
  return (
    <>
      <RBox size={[w, 0.016, d]} r={0} pos={[0, 0.008, 0]} m={col(edge, 1)} />
      <RBox size={[w - 0.24, 0.017, d - 0.24]} r={0} pos={[0, 0.0085, 0]} m={col(base, 1)} />
      <RBox size={[w - 0.6, 0.018, 0.06]} r={0} pos={[0, 0.009, d / 2 - 0.3]} m={col(edge, 1)} />
      <RBox size={[w - 0.6, 0.018, 0.06]} r={0} pos={[0, 0.009, -d / 2 + 0.3]} m={col(edge, 1)} />
    </>
  );
}

// ---------- lantai 2: permainan ----------

/** Mesin arcade (menghadap +z): badan, layar menyala, panel tombol & joystick. */
function Arcade() {
  return (
    <>
      <RBox size={[0.9, 1.9, 0.8]} r={0.03} pos={[0, 0.95, -0.05]} m={col("#3b2a63", 0.5)} />
      {[-1, 1].map((s) => (
        <RBox key={s} size={[0.012, 1.5, 0.6]} r={0} pos={[0.452 * s, 1.0, 0]} m={col("#ff5fa2", 0.4, { emissive: "#ff5fa2", ei: 0.25 })} />
      ))}
      <RBox size={[0.94, 0.28, 0.84]} r={0.03} pos={[0, 2.0, -0.05]} m={col("#2a1d47", 0.5)} />
      <mesh position={[0, 2.0, 0.375]}>
        <planeGeometry args={[0.8, 0.2]} />
        <meshStandardMaterial color="#ff5fa2" emissive="#ff5fa2" emissiveIntensity={0.8} />
      </mesh>
      <RBox size={[0.76, 0.6, 0.02]} r={0.01} pos={[0, 1.5, 0.35]} m={M.black} />
      <mesh position={[0, 1.5, 0.362]}>
        <planeGeometry args={[0.7, 0.54]} />
        <meshStandardMaterial color="#0b1a0f" emissive="#3dd36b" emissiveIntensity={0.45} />
      </mesh>
      <RBox size={[0.9, 0.08, 0.36]} r={0.02} pos={[0, 1.05, 0.5]} rot={[0.12, 0, 0]} m={col("#2a1d47", 0.5)} />
      <Cyl r={0.012} h={0.1} pos={[-0.2, 1.13, 0.52]} m={M.black} />
      <Ball r={0.03} pos={[-0.2, 1.19, 0.52]} m={col("#e33", 0.4)} />
      {[0.06, 0.16, 0.26].map((x, i) => (
        <Cyl key={x} r={0.028} h={0.03} pos={[x, 1.1, 0.52 - (i % 2) * 0.04]} m={col(["#ffd23f", "#3fa7ff", "#3dd36b"][i], 0.4)} />
      ))}
      <RBox size={[0.24, 0.3, 0.02]} r={0.008} pos={[0, 0.5, 0.355]} m={M.black} />
      {[-0.05, 0.05].map((x) => (
        <RBox key={x} size={[0.03, 0.08, 0.006]} r={0} pos={[x, 0.55, 0.368]} m={col("#ffd23f", 0.4, { emissive: "#ff9d00", ei: 0.4 })} />
      ))}
    </>
  );
}

/** Meja Empat Sejajar: meja kecil dengan papan biru berdiri di tengah (dilihat dari kedua sisi). */
function GameTable() {
  return (
    <>
      <Table w={1.2} d={0.9} />
      <RBox size={[0.84, 0.62, 0.05]} r={0.015} pos={[0, 1.09, 0]} m={col("#2c5fd6", 0.4)} />
      <RBox size={[0.96, 0.04, 0.12]} r={0.01} pos={[0, 0.79, 0]} m={col("#2c5fd6", 0.4)} />
      {/* beberapa keping hiasan (state permainan sungguhan tampil di jendela game) */}
      {([[-3, 5, "#e74c3c"], [-2, 5, "#f1c40f"], [-2, 4, "#e74c3c"], [0, 5, "#f1c40f"], [1, 5, "#e74c3c"], [1, 4, "#f1c40f"]] as const).map(([c, r, color]) => (
        <Cyl key={`${c}-${r}`} r={0.04} h={0.06} seg={14} pos={[c * 0.11, 0.84 + (5 - r) * 0.095, 0]} rot={[PI / 2, 0, 0]} m={col(color, 0.4)} />
      ))}
    </>
  );
}

function PingPong() {
  const top = 0.76;
  return (
    <>
      <RBox size={[2.74, 0.03, 1.52]} r={0.008} pos={[0, top - 0.015, 0]} m={col("#1f5f8b", 0.55)} />
      {/* garis putih */}
      {[-1, 1].map((s) => (
        <RBox key={`l${s}`} size={[2.74, 0.002, 0.02]} r={0} pos={[0, top + 0.001, 0.75 * s]} m={M.white} />
      ))}
      {[-1, 1].map((s) => (
        <RBox key={`e${s}`} size={[0.02, 0.002, 1.52]} r={0} pos={[1.36 * s, top + 0.001, 0]} m={M.white} />
      ))}
      <RBox size={[2.7, 0.002, 0.006]} r={0} pos={[0, top + 0.001, 0]} m={M.white} />
      <RBox size={[0.012, 0.15, 1.7]} r={0} pos={[0, top + 0.075, 0]} m={col("#f0f0f0", 0.9, { opacity: 0.75 })} />
      <RBox size={[0.02, 0.02, 1.7]} r={0} pos={[0, top + 0.152, 0]} m={M.white} />
      {[-1, 1].map((s) => (
        <Cyl key={s} r={0.012} h={0.17} pos={[0, top + 0.08, 0.85 * s]} m={M.metal} />
      ))}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <RBox key={`${sx}${sz}`} size={[0.05, top - 0.03, 0.05]} pos={[1.1 * sx, (top - 0.03) / 2, 0.6 * sz]} m={M.metal} />),
      )}
      {[-1, 1].map((s) => (
        <RBox key={s} size={[0.05, 0.05, 1.25]} pos={[1.1 * s, 0.2, 0]} m={M.metal} />
      ))}
      <Ball r={0.02} pos={[0.5, top + 0.02, 0.2]} m={col("#ff8c1a", 0.5)} />
    </>
  );
}

function Foosball() {
  const rods = [-0.5, -0.36, -0.2, -0.06, 0.06, 0.2, 0.36, 0.5];
  return (
    <>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <RBox key={`${sx}${sz}`} size={[0.08, 0.6, 0.08]} pos={[0.6 * sx, 0.3, 0.32 * sz]} m={M.walnut} />),
      )}
      <RBox size={[1.3, 0.24, 0.76]} r={0.015} pos={[0, 0.72, 0]} m={M.walnut} />
      <RBox size={[1.16, 0.01, 0.62]} r={0} pos={[0, 0.8, 0]} m={col("#2f8f4e", 0.8)} />
      <RBox size={[1.0, 0.003, 0.01]} r={0} pos={[0, 0.806, 0]} rot={[0, PI / 2, 0]} m={M.white} />
      {rods.map((x, i) => (
        <group key={x} position={[x, 0.88, 0]}>
          <Cyl r={0.01} h={1.1} seg={8} rot={[PI / 2, 0, 0]} m={M.chrome} />
          {[-1, 1].map((s) => (
            <Cyl key={s} r={0.022} h={0.12} pos={[0, 0, 0.6 * s]} rot={[PI / 2, 0, 0]} m={M.black} />
          ))}
          {[-0.18, 0, 0.18].slice(0, i % 3 === 0 ? 2 : 3).map((z) => (
            <RBox key={z} size={[0.03, 0.1, 0.05]} r={0.01} pos={[0, -0.04, z]} m={col(i % 2 ? "#d63c41" : "#2f6fd6", 0.5)} />
          ))}
        </group>
      ))}
    </>
  );
}

function Billiard() {
  const felt = 0.79;
  const balls: [number, number, string][] = [[0.6, 0, "#f1c40f"], [0.66, 0.035, "#2f6fd6"], [0.66, -0.035, "#d63c41"], [0.72, 0.07, "#8e44ad"], [0.72, 0, "#1d1b22"], [0.72, -0.07, "#e67e22"], [-0.6, 0, "#f7f7f2"]];
  return (
    <>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => <RBox key={`${sx}${sz}`} size={[0.14, 0.62, 0.14]} r={0.02} pos={[1.1 * sx, 0.31, 0.6 * sz]} m={M.walnut} />),
      )}
      <RBox size={[2.5, 0.18, 1.4]} r={0.02} pos={[0, 0.68, 0]} m={M.walnut} />
      <RBox size={[2.34, 0.03, 1.24]} r={0} pos={[0, felt - 0.015, 0]} m={col("#1f7a5a", 0.95)} />
      {[-1, 1].map((s) => (
        <RBox key={`x${s}`} size={[2.6, 0.07, 0.13]} r={0.02} pos={[0, felt + 0.02, 0.685 * s]} m={M.walnut} />
      ))}
      {[-1, 1].map((s) => (
        <RBox key={`z${s}`} size={[0.13, 0.07, 1.5]} r={0.02} pos={[1.235 * s, felt + 0.02, 0]} m={M.walnut} />
      ))}
      {[-1, 0, 1].flatMap((px) => [-1, 1].map((pz) => <Cyl key={`${px}${pz}`} r={0.055} h={0.012} pos={[1.16 * px, felt + 0.002, 0.61 * pz]} m={M.black} />))}
      {balls.map(([x, z, c]) => (
        <Ball key={`${x}${z}`} r={0.028} pos={[x, felt + 0.028, z]} m={col(c, 0.2)} />
      ))}
      <Cyl r={0.008} r2={0.013} h={1.4} pos={[-0.2, felt + 0.03, 0.3]} rot={[0, 0.2, PI / 2 - 0.02]} m={M.oak} />
    </>
  );
}

export function Furniture({ type, room, zone, itemId, chair }: { type: ItemType; room: string | null; zone: string | null; itemId: string; chair?: ChairStyle }) {
  switch (type) {
    case "desk":
      return <Desk />;
    case "chair":
      if (chair?.style === "exec") return <ExecutiveChair leather={chair.leather} />;
      if (chair?.style === "guest") return <GuestChair leather={chair.leather} />;
      return <SideChair />;
    case "sofa":
      return <Sofa />;
    case "tableLarge":
      return <Table w={6} d={2.2} />;
    case "tableSmall":
      return <Table w={1.6} d={1} />;
    case "coffeeTable":
      return <CoffeeTable />;
    case "rug":
      return <RugRound />;
    case "plant":
      return <Plant />;
    case "reception":
      return <Reception />;
    case "counter":
      return <Counter />;
    case "fridge":
      return <Fridge />;
    case "bookshelf":
      return <Bookshelf />;
    case "screen":
      return <Screen zone={zone} itemId={itemId} />;
    case "podium":
      return <Podium />;
    case "elevator":
      return <Elevator />;
    case "whiteboard":
      return <Whiteboard room={room} />;
    case "arcade":
      return <Arcade />;
    case "gameTable":
      return <GameTable />;
    case "toilet":
      return <ToiletStall />;
    case "sink":
      return <Sink />;
    case "prayerMat":
      return <PrayerMat />;
    case "clock":
      return <Clock />;
    case "dispenser":
      return <Dispenser />;
    case "frame":
      return <Frame />;
    case "floorLamp":
      return <FloorLamp />;
    case "printer":
      return <Printer />;
    case "bin":
      return <Bin />;
    case "magazineRack":
      return <MagazineRack />;
    case "treePlant":
      return <TreePlant />;
    case "rugRect":
      return <RugRect w={4} d={2.4} base="#c9d8ea" edge="#9fb6d1" />;
    case "playRug":
      return <RugRect w={10} d={6} base="#f6e3b4" edge="#e8c77d" />;
    case "noticeBoard":
      return <NoticeBoard />;
    case "beanBag":
      return <BeanBag />;
    case "coffeeMachine":
      return <CoffeeMachine />;
    case "vending":
      return <Vending />;
    case "snackShelf":
      return <SnackShelf />;
    case "barStool":
      return <BarStool />;
    case "hangingPlant":
      return <HangingPlant />;
    case "poster":
      return <Poster />;
    case "wallShelf":
      return <WallShelf />;
    case "tv":
      return <Tv />;
    case "logoBoard":
      return <LogoBoard />;
    case "pingPong":
      return <PingPong />;
    case "foosball":
      return <Foosball />;
    case "billiard":
      return <Billiard />;
    case "prizeShelf":
      return <PrizeShelf />;
    case "window":
      return <Window />;
  }
}
