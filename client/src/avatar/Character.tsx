import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  LatheGeometry,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Group,
  type Material,
} from "three";
import type { AvatarConfig } from "./config";
import { ANIM } from "../anims";

// Karakter semi-realistis dari primitif. Tinggi ±1,78 m, menghadap +z.
// Struktur: root → hips → (kaki kiri/kanan) + torso → (lengan kiri/kanan, kepala).
// Kepala dimodelkan dalam ukuran lama (bola r 0,25) lalu diperkecil lewat HEAD_SCALE ke proporsi manusia
// (±7 kepala per tinggi badan) — rambut, hijab, topi & kacamata ikut mengecil tanpa diubah satu per satu.

const PI = Math.PI;
const HIPS_Y = 0.82;
const HEAD_Y = 0.8;
const HEAD_SCALE: [number, number, number] = [0.58, 0.66, 0.62];

// Geometri dipakai bersama oleh semua avatar (dibuat sekali).
const G = {
  // Badan diputar dari profil (jari-jari, tinggi): pinggul → pinggang → dada → bahu melandai → pangkal leher.
  torso: new LatheGeometry(
    [[0, -0.07], [0.17, -0.06], [0.176, 0.04], [0.166, 0.15], [0.18, 0.26], [0.2, 0.37], [0.205, 0.44], [0.19, 0.5], [0.14, 0.55], [0.07, 0.58], [0, 0.585]].map(
      ([r, y]) => new Vector2(r, y),
    ),
    20,
  ),
  elbow: new SphereGeometry(0.05, 10, 8),
  knee: new SphereGeometry(0.078, 12, 8),
  pelvis: new SphereGeometry(0.2, 16, 12),
  upperArm: new CapsuleGeometry(0.058, 0.17, 4, 10),
  forearm: new CapsuleGeometry(0.048, 0.15, 4, 10),
  hand: new SphereGeometry(0.05, 12, 10),
  thumb: new CapsuleGeometry(0.016, 0.035, 3, 6),
  thigh: new CapsuleGeometry(0.09, 0.2, 4, 12),
  shin: new CapsuleGeometry(0.075, 0.2, 4, 12),
  shoe: new SphereGeometry(1, 14, 10),
  sole: new BoxGeometry(0.15, 0.025, 0.28),
  neck: new CylinderGeometry(0.052, 0.062, 0.18, 14),
  head: new SphereGeometry(0.25, 32, 24),
  eye: new SphereGeometry(0.042, 14, 10),
  iris: new SphereGeometry(0.021, 12, 10),
  brow: new BoxGeometry(0.08, 0.011, 0.01),
  nose: new SphereGeometry(0.04, 12, 10),
  ear: new SphereGeometry(0.06, 12, 10),
  lips: new SphereGeometry(0.045, 14, 10),
  // rambut
  cap: new SphereGeometry(0.268, 28, 14, 0, 2 * PI, 0, 0.5 * PI),
  buzz: new SphereGeometry(0.258, 28, 14, 0, 2 * PI, 0, 0.42 * PI),
  shellBob: new SphereGeometry(0.29, 28, 14, PI / 2 + 0.75, 2 * PI - 1.5, 0.18 * PI, 0.45 * PI),
  shellLong: new SphereGeometry(0.29, 28, 14, PI / 2 + 0.75, 2 * PI - 1.5, 0.18 * PI, 0.52 * PI),
  backLong: new CapsuleGeometry(0.12, 0.28, 6, 12),
  spike: new ConeGeometry(0.06, 0.17, 6),
  curl: new IcosahedronGeometry(0.06, 1),
  bun: new SphereGeometry(0.11, 16, 12),
  tieBall: new SphereGeometry(0.06, 12, 10),
  tail: new CapsuleGeometry(0.065, 0.2, 4, 10),
  // hijab
  hijabShell: new SphereGeometry(0.285, 32, 18, PI / 2 + 0.68, 2 * PI - 1.36, 0, 0.75 * PI),
  hijabTop: new SphereGeometry(0.287, 32, 8, 0, 2 * PI, 0, 0.28 * PI),
  hijabDrape: new CylinderGeometry(0.17, 0.37, 0.34, 32, 1, true),
  // aksesori
  hatDome: new SphereGeometry(0.28, 28, 12, 0, 2 * PI, 0, 0.5 * PI),
  brim: new CylinderGeometry(0.16, 0.16, 0.02, 24),
  beanie: new SphereGeometry(0.28, 28, 12, 0, 2 * PI, 0, 0.56 * PI),
  beanieRim: new TorusGeometry(0.262, 0.035, 8, 32),
  lensRound: new TorusGeometry(0.052, 0.009, 8, 24),
  lensSquare: new TorusGeometry(0.062, 0.009, 4, 4),
  bridge: new BoxGeometry(0.055, 0.01, 0.01),
  // pakaian
  collar: new TorusGeometry(0.095, 0.025, 6, 18),
  neckline: new TorusGeometry(0.075, 0.012, 6, 18),
  belt: new TorusGeometry(0.205, 0.01, 4, 28),
  hood: new SphereGeometry(0.16, 16, 12),
  pocket: new BoxGeometry(0.22, 0.1, 0.02),
  shirtFront: new BoxGeometry(0.11, 0.3, 0.02),
  tie: new BoxGeometry(0.04, 0.24, 0.022),
  skirt: new CylinderGeometry(0.2, 0.34, 0.4, 28, 1, true),
};

// Posisi duri & ikal pada permukaan kepala (arah dari pusat kepala).
function onSphere(theta: number, phi: number) {
  // phi = PI/2 → depan (+z)
  return new Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
}
const UP = new Vector3(0, 1, 0);
const SPIKES = [
  [0.05, 0], [0.22, 1.2], [0.22, 2.4], [0.22, 3.6], [0.22, 4.8], [0.22, 6.0], [0.38, 0.6], [0.38, 2.2], [0.38, 3.0], [0.38, 3.9], [0.38, 5.4],
].map(([t, p]) => {
  const dir = onSphere(t * PI, p);
  return { pos: dir.clone().multiplyScalar(0.25), quat: new Quaternion().setFromUnitVectors(UP, dir) };
});
const CURLS = Array.from({ length: 22 }, (_, i) => {
  const theta = (0.08 + (i % 4) * 0.13) * PI;
  const phi = (i / 22) * 2 * PI * 3.1;
  return { theta, phi };
})
  // jangan menutupi wajah: buang yang di depan bawah
  .filter(({ theta, phi }) => !(theta > 0.25 * PI && Math.abs(((phi % (2 * PI)) + 2 * PI) % (2 * PI) - PI / 2) < 0.8))
  .map(({ theta, phi }) => onSphere(theta, phi).multiplyScalar(0.27));

type Pose = {
  bob: number; lean: number; twist: number; headX: number; headZ: number;
  lsx: number; lsz: number; rsx: number; rsz: number; le: number; re: number;
  lh: number; rh: number; lk: number; rk: number;
};
const POSE_KEYS = ["bob", "lean", "twist", "headX", "headZ", "lsx", "lsz", "rsx", "rsz", "le", "re", "lh", "rh", "lk", "rk"] as const;

// Pose target per state animasi. Sumbu: rotasi x negatif = ayun ke depan; lengan kiri di +x.
function targetPose(anim: number, t: number): Pose {
  const idle: Pose = {
    bob: Math.sin(t * 2) * 0.006, lean: 0, twist: 0, headX: Math.sin(t * 0.7) * 0.04, headZ: Math.sin(t * 0.5) * 0.03,
    lsx: Math.sin(t * 1.5) * 0.03, lsz: 0.1, rsx: -Math.sin(t * 1.5) * 0.03, rsz: -0.1, le: -0.15, re: -0.15,
    lh: 0, rh: 0, lk: 0, rk: 0,
  };
  switch (anim) {
    case ANIM.walk:
    case ANIM.run: {
      const run = anim === ANIM.run;
      const ph = t * (run ? 13 : 8.5);
      const s = Math.sin(ph);
      const leg = run ? 0.85 : 0.5;
      const arm = run ? 0.9 : 0.45;
      return {
        bob: Math.abs(Math.cos(ph)) * (run ? 0.07 : 0.035), lean: run ? 0.2 : 0.05, twist: s * (run ? 0.12 : 0.07),
        headX: run ? -0.12 : 0, headZ: 0,
        lsx: arm * s, lsz: 0.12, rsx: -arm * s, rsz: -0.12, le: run ? -1.3 : -0.35, re: run ? -1.3 : -0.35,
        lh: -leg * s, rh: leg * s, lk: Math.max(0, -s) * (run ? 1.3 : 0.8), rk: Math.max(0, s) * (run ? 1.3 : 0.8),
      };
    }
    case ANIM.wave:
      return { ...idle, rsz: -2.55 + Math.sin(t * 10) * 0.28, rsx: -0.2, re: -0.35, headZ: -0.12, headX: -0.05 };
    case ANIM.thumbs:
      return { ...idle, rsx: -1.35, rsz: -0.15, re: -1.1, headX: 0.1 + Math.abs(Math.sin(t * 6)) * 0.08 };
    case ANIM.sit:
      // Pinggul turun setinggi dudukan (±0,45 m), paha ke depan, betis tegak, tangan di pangkuan/meja.
      return {
        bob: -0.37 + Math.sin(t * 1.6) * 0.004, lean: -0.04, twist: 0, headX: Math.sin(t * 0.6) * 0.05, headZ: 0,
        lsx: -0.55, lsz: 0.12, rsx: -0.55, rsz: -0.12, le: -0.75, re: -0.75,
        lh: -1.52, rh: -1.52, lk: 1.5, rk: 1.5,
      };
    case ANIM.dance: {
      const ph = t * 6;
      return {
        bob: Math.abs(Math.sin(ph)) * 0.07, lean: 0, twist: Math.sin(ph / 2) * 0.4, headX: 0, headZ: Math.sin(ph / 2) * 0.18,
        lsx: -0.3, lsz: 1.3 + Math.sin(ph) * 0.6, rsx: -0.3, rsz: -(1.3 + Math.cos(ph) * 0.6), le: -1.0, re: -1.0,
        lh: Math.sin(ph) * 0.25, rh: -Math.sin(ph) * 0.25, lk: Math.max(0, Math.sin(ph)) * 0.5, rk: Math.max(0, -Math.sin(ph)) * 0.5,
      };
    }
    default:
      return idle;
  }
}

function useMaterials(c: AvatarConfig) {
  const mats = useMemo(() => {
    const m = (color: string, extra: Partial<MeshStandardMaterial> = {}) =>
      new MeshStandardMaterial({ color, roughness: 0.75, ...extra });
    const darker = (hex: string, f: number) => "#" + new Color(hex).multiplyScalar(f).getHexString();
    return {
      skin: m(c.skin, { roughness: 0.55 }),
      lips: m("#" + new Color(c.skin).lerp(new Color("#a8504a"), 0.4).getHexString(), { roughness: 0.45 }),
      eyeWhite: m("#f4f1ec", { roughness: 0.3 }),
      iris: m("#3b2618", { roughness: 0.2 }),
      hair: m(c.hairColor, { roughness: 0.85, side: DoubleSide }),
      hijab: m(c.hijabColor, { roughness: 0.9, side: DoubleSide }),
      top: m(c.topColor),
      topAccent: m(darker(c.topColor, 0.8)),
      bottom: m(c.bottomColor, { side: DoubleSide }),
      shoe: m(c.shoeColor, { roughness: 0.5 }),
      dark: m("#1d1b22", { roughness: 0.4 }),
      white: m("#f7f7f2"),
      tie: m("#8b1e2d"),
      brow: m(darker(c.hairColor, 0.8)),
    };
  }, [c]);
  useEffect(() => () => Object.values(mats).forEach((mt: Material) => mt.dispose()), [mats]);
  return mats;
}

// Bayangan asli mahal (setiap bagian digambar ulang di shadow pass) → hanya untuk avatar sendiri.
const ShadowCtx = createContext(true);

function Part({ g, m, ...props }: { g: BufferGeometry; m: Material } & Record<string, unknown>) {
  return <mesh geometry={g} material={m} castShadow={useContext(ShadowCtx)} {...props} />;
}

// ---------- versi sederhana untuk avatar jauh (LOD): 4 bagian, tanpa tulang/sendi ----------

const LOW = {
  body: new CapsuleGeometry(0.22, 0.42, 3, 8),
  legs: new CapsuleGeometry(0.17, 0.42, 3, 8),
  head: new SphereGeometry(0.155, 12, 10),
  hair: new SphereGeometry(0.168, 12, 6, 0, 2 * PI, 0, 0.55 * PI),
};

export function CharacterLow({ config: c, getAnim }: { config: AvatarConfig; getAnim: () => number }) {
  const mat = useMaterials(c);
  const root = useRef<Group>(null);
  const seed = useMemo(() => Math.random() * 100, []);
  useFrame((state) => {
    if (!root.current) return;
    const a = getAnim();
    const t = state.clock.elapsedTime + seed;
    const moving = a === ANIM.walk || a === ANIM.run;
    root.current.position.y = a === ANIM.sit ? -0.37 : moving ? Math.abs(Math.sin(t * (a === ANIM.run ? 13 : 8.5))) * 0.05 : 0;
  });
  return (
    <group ref={root}>
      <mesh geometry={LOW.legs} material={c.bottom === "pants" ? mat.bottom : mat.skin} position={[0, 0.45, 0]} scale={[1.15, 1, 0.8]} />
      <mesh geometry={LOW.body} material={mat.top} position={[0, 1.07, 0]} scale={[1.1, 1, 0.8]} />
      <mesh geometry={LOW.head} material={mat.skin} position={[0, 1.62, 0]} scale={[0.93, 1.06, 1]} />
      {(c.hijab || c.hair !== "none") && <mesh geometry={LOW.hair} material={c.hijab ? mat.hijab : mat.hair} position={[0, 1.62, 0]} rotation-x={-0.35} />}
    </group>
  );
}

export function Character({
  config: c,
  getAnim,
  handUp = false,
  castShadows = true,
}: {
  config: AvatarConfig;
  getAnim: () => number;
  handUp?: boolean;
  castShadows?: boolean;
}) {
  const mat = useMaterials(c);
  const male = c.body === "male";
  const shoulderX = male ? 0.27 : 0.245;
  const sleeveLong = c.top !== "tshirt";

  const root = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const ls = useRef<Group>(null);
  const rs = useRef<Group>(null);
  const le = useRef<Group>(null);
  const re = useRef<Group>(null);
  const lh = useRef<Group>(null);
  const rh = useRef<Group>(null);
  const lk = useRef<Group>(null);
  const rk = useRef<Group>(null);

  const pose = useRef<Pose>(targetPose(ANIM.idle, 0));
  const seed = useMemo(() => Math.random() * 100, []);

  useFrame((state, dt) => {
    const target = targetPose(getAnim(), state.clock.elapsedTime + seed);
    if (handUp) {
      // Angkat tangan (rapat): lengan kanan lurus ke atas, sedikit melambai.
      target.rsz = -2.95 + Math.sin(state.clock.elapsedTime * 3) * 0.06;
      target.rsx = -0.1;
      target.re = -0.1;
    }
    const p = pose.current;
    const k = 1 - Math.exp(-18 * Math.min(dt, 0.1));
    for (const key of POSE_KEYS) p[key] += (target[key] - p[key]) * k;
    if (!root.current || !torso.current || !head.current) return;
    root.current.position.y = p.bob;
    torso.current.rotation.set(p.lean, p.twist, 0);
    head.current.rotation.set(p.headX, 0, p.headZ);
    ls.current?.rotation.set(p.lsx, 0, p.lsz);
    rs.current?.rotation.set(p.rsx, 0, p.rsz);
    le.current?.rotation.set(p.le, 0, 0);
    re.current?.rotation.set(p.re, 0, 0);
    lh.current?.rotation.set(p.lh, 0, 0);
    rh.current?.rotation.set(p.rh, 0, 0);
    lk.current?.rotation.set(p.lk, 0, 0);
    rk.current?.rotation.set(p.rk, 0, 0);
  });

  const legs = (side: 1 | -1) => (
    <group ref={side === 1 ? lh : rh} position={[0.1 * side, -0.02, 0]}>
      <Part g={G.thigh} m={c.bottom === "skirt" ? mat.skin : mat.bottom} position={[0, -0.19, 0]} />
      <group ref={side === 1 ? lk : rk} position={[0, -0.38, 0]}>
        <Part g={G.knee} m={c.bottom === "pants" ? mat.bottom : mat.skin} />
        <Part g={G.shin} m={c.bottom === "pants" ? mat.bottom : mat.skin} position={[0, -0.155, 0]} />
        <Part g={G.shoe} m={mat.shoe} position={[0, -0.355, 0.035]} scale={[0.072, 0.055, 0.13]} />
        <Part g={G.sole} m={mat.dark} position={[0, -0.395, 0.035]} scale={[0.95, 1, 0.92]} />
      </group>
    </group>
  );

  const arm = (side: 1 | -1) => (
    <group ref={side === 1 ? ls : rs} position={[shoulderX * side, 0.47, 0]}>
      <Part g={G.upperArm} m={mat.top} position={[0, -0.14, 0]} />
      <group ref={side === 1 ? le : re} position={[0, -0.28, 0]}>
        <Part g={G.elbow} m={sleeveLong ? mat.top : mat.skin} />
        <Part g={G.forearm} m={sleeveLong ? mat.top : mat.skin} position={[0, -0.115, 0]} />
        <Part g={G.hand} m={mat.skin} position={[0, -0.27, 0.005]} scale={[0.62, 1.25, 1]} />
        <Part g={G.thumb} m={mat.skin} position={[-0.012 * side, -0.245, 0.04]} rotation-x={0.5} />
      </group>
    </group>
  );

  return (
    <ShadowCtx.Provider value={castShadows}>
    <group ref={root}>
      <group position={[0, HIPS_Y, 0]}>
        <Part g={G.pelvis} m={mat.bottom} position={[0, 0.03, 0]} scale={male ? [1.02, 0.5, 0.74] : [1.04, 0.5, 0.74]} />
        {c.bottom === "skirt" && <Part g={G.skirt} m={mat.bottom} position={[0, -0.12, 0]} />}
        {c.bottom !== "skirt" && c.top !== "hoodie" && <Part g={G.belt} m={mat.dark} position={[0, 0.07, 0]} rotation-x={PI / 2} scale={male ? [0.98, 0.69, 1] : [0.95, 0.69, 1]} />}
        {legs(1)}
        {legs(-1)}

        <group ref={torso}>
          <Part g={G.torso} m={mat.top} scale={male ? [1.12, 1, 0.74] : [0.98, 1, 0.72]} />
          <Part g={G.neck} m={mat.skin} position={[0, 0.63, 0.005]} />
          {c.top === "tshirt" && <Part g={G.neckline} m={mat.topAccent} position={[0, 0.555, 0.01]} rotation-x={PI / 2} scale={[1.15, 1, 1]} />}
          {c.top === "shirt" && <Part g={G.collar} m={mat.topAccent} position={[0, 0.56, 0]} rotation-x={PI / 2} />}
          {c.top === "hoodie" && (
            <>
              <Part g={G.hood} m={mat.top} position={[0, 0.52, -0.14]} scale={[1.3, 0.8, 0.8]} />
              <Part g={G.pocket} m={mat.topAccent} position={[0, 0.1, 0.128]} />
            </>
          )}
          {c.top === "suit" && (
            <>
              <Part g={G.shirtFront} m={mat.white} position={[0, 0.38, 0.152]} />
              <Part g={G.tie} m={mat.tie} position={[0, 0.38, 0.165]} />
            </>
          )}
          {arm(1)}
          {arm(-1)}

          <group ref={head} position={[0, HEAD_Y, 0]} scale={HEAD_SCALE}>
            <Part g={G.head} m={mat.skin} />
            {[1, -1].map((s) => (
              <group key={s}>
                <Part g={G.eye} m={mat.eyeWhite} position={[0.088 * s, 0.01, 0.208]} scale={[1, 0.62, 0.5]} />
                <Part g={G.iris} m={mat.iris} position={[0.086 * s, 0.01, 0.225]} scale={[1, 1.05, 0.5]} />
                <Part g={G.brow} m={mat.brow} position={[0.09 * s, 0.075, 0.226]} rotation-z={0.1 * s} />
                <Part g={G.ear} m={mat.skin} position={[0.238 * s, -0.005, 0]} scale={[0.4, 0.95, 0.65]} />
              </group>
            ))}
            <Part g={G.nose} m={mat.skin} position={[0, -0.045, 0.235]} scale={[0.62, 1.05, 0.85]} />
            <Part g={G.lips} m={mat.lips} position={[0, -0.13, 0.205]} scale={[1, 0.3, 0.42]} />

            {c.hijab ? (
              <>
                <Part g={G.hijabShell} m={mat.hijab} />
                <Part g={G.hijabTop} m={mat.hijab} />
                {/* kerudung menjuntai sampai bahu (dikoreksi dari skala kepala yang diperkecil) */}
                <Part g={G.hijabDrape} m={mat.hijab} position={[0, -0.36, -0.01]} scale={[1.05, 1.1, 0.85]} />
              </>
            ) : (
              <Hair style={c.hair} m={mat.hair} />
            )}

            {!c.hijab && c.hat === "cap" && (
              <>
                <Part g={G.hatDome} m={mat.top} rotation-x={-0.18} />
                <Part g={G.brim} m={mat.topAccent} position={[0, 0.07, 0.2]} rotation-x={0.12} scale={[1, 1, 1.15]} />
              </>
            )}
            {!c.hijab && c.hat === "beanie" && (
              <>
                <Part g={G.beanie} m={mat.top} rotation-x={-0.2} />
                <Part g={G.beanieRim} m={mat.topAccent} position={[0, 0.05, -0.04]} rotation-x={PI / 2 - 0.2} />
              </>
            )}

            {c.glasses !== "none" && (
              <group position={[0, 0.005, 0.25]}>
                {[1, -1].map((s) => (
                  <Part
                    key={s}
                    g={c.glasses === "round" ? G.lensRound : G.lensSquare}
                    m={mat.dark}
                    position={[0.085 * s, 0, 0]}
                    rotation-z={c.glasses === "square" ? PI / 4 : 0}
                    scale={c.glasses === "square" ? [1, 0.8, 1] : 1}
                  />
                ))}
                <Part g={G.bridge} m={mat.dark} position={[0, 0.01, 0.005]} />
              </group>
            )}
          </group>
        </group>
      </group>
    </group>
    </ShadowCtx.Provider>
  );
}

function Hair({ style, m }: { style: AvatarConfig["hair"]; m: Material }) {
  if (style === "none") return null;
  if (style === "buzz") return <Part g={G.buzz} m={m} rotation-x={-0.3} />;
  const cap = <Part g={G.cap} m={m} rotation-x={-0.35} />;
  switch (style) {
    case "spiky":
      return (
        <>
          {cap}
          {SPIKES.map((s, i) => (
            <Part key={i} g={G.spike} m={m} position={s.pos} quaternion={s.quat} />
          ))}
        </>
      );
    case "curly":
      return (
        <>
          {cap}
          {CURLS.map((p, i) => (
            <Part key={i} g={G.curl} m={m} position={p} />
          ))}
        </>
      );
    case "bob":
      return (
        <>
          {cap}
          <Part g={G.shellBob} m={m} />
        </>
      );
    case "long":
      return (
        <>
          {cap}
          <Part g={G.shellLong} m={m} />
          <Part g={G.backLong} m={m} position={[0, -0.28, -0.13]} scale={[1.75, 1, 0.55]} rotation-x={0.12} />
        </>
      );
    case "ponytail":
      return (
        <>
          {cap}
          <Part g={G.tieBall} m={m} position={[0, 0.06, -0.27]} />
          <Part g={G.tail} m={m} position={[0, -0.11, -0.31]} rotation-x={0.28} />
        </>
      );
    case "bun":
      return (
        <>
          {cap}
          <Part g={G.bun} m={m} position={[0, 0.2, -0.17]} />
        </>
      );
    default:
      return cap;
  }
}
