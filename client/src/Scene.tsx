import { Suspense, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, OrthographicCamera, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Physics } from "@react-three/rapier";
import { World } from "./World";
import { Player } from "./Player";
import { RemotePlayer } from "./RemotePlayer";
import { useNet } from "./net";
import { useGraphics } from "./graphics";
import { PAL } from "./world2d/palette";

export { useGraphics, type Quality } from "./graphics";

// Hitung FPS nyata (dua kali per detik) untuk ditampilkan di HUD.
function FpsMeter() {
  const frames = useRef(0);
  const since = useRef(performance.now());
  const last = useRef({ calls: 0, tris: 0 });
  useFrame(({ gl }) => {
    // autoReset dimatikan di Canvas: angka di sini = total semua pass frame sebelumnya (scene, shadow, efek).
    last.current = { calls: gl.info.render.calls, tris: gl.info.render.triangles };
    gl.info.reset();
    frames.current++;
    const now = performance.now();
    if (now - since.current >= 500) {
      // draw call & segitiga per frame (termasuk shadow pass) — ukuran beban render yang objektif.
      useGraphics.setState({ fps: Math.round((frames.current * 1000) / (now - since.current)), ...last.current });
      frames.current = 0;
      since.current = now;
    }
  });
  return null;
}

const BG = PAL.bg; // abu dingin (palet B), bukan krem

// Cahaya lingkungan dibangkitkan dari "lampu" virtual (tanpa unduh HDR): jendela utara + plafon + lampu hangat.
function Lighting({ flat }: { flat: boolean }) {
  if (flat) {
    // Tanpa pantulan lingkungan & bayangan: langit-tanah lebih terang supaya warna tetap hidup.
    return (
      <>
        <hemisphereLight args={["#ffffff", "#b8bfc8", 1.6]} />
        <directionalLight position={[-12, 20, 8]} intensity={1.8} color="#fffaf2" />
      </>
    );
  }
  return (
    <>
      <hemisphereLight args={["#ffffff", "#b8bfc8", 0.35]} />
      <directionalLight position={[-12, 20, 8]} intensity={2.6} color="#fffaf2" />
      <Environment resolution={128} frames={1} environmentIntensity={0.45}>
        <Lightformer form="rect" intensity={2.5} color="#e3f1ff" position={[0, 6, -16]} scale={[40, 6, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[40, 30, 1]} />
        <Lightformer form="circle" intensity={1.5} color="#ffd6a8" position={[14, 5, 10]} scale={6} />
      </Environment>
    </>
  );
}

function Effects({ high, flat }: { high: boolean; flat: boolean }) {
  if (flat) return null; // tanpa pass layar penuh sama sekali
  if (!high) {
    return (
      <EffectComposer multisampling={0}>
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <SMAA />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur luminanceThreshold={0.9} intensity={0.45} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
      <Vignette offset={0.3} darkness={0.35} />
    </EffectComposer>
  );
}

export function Scene() {
  const players = useNet((s) => s.players);
  const floor = useNet((s) => s.floor);
  const quality = useGraphics((s) => s.quality);
  const high = quality === "high";
  const flat = quality === "flat";
  // Isi dunia (berisi label <Html>) baru dirender setelah event kanvas tersambung. Tanpa ini, saat 3D dipasang ulang
  // (ganti tampilan 2D → 3D kedua kalinya, Rapier sudah ada di cache) label terpasang sebelum event tersambung dan
  // drei memindahkannya di tengah render → "removeChild" gagal saat 3D dilepas.
  const [ready, setReady] = useState(false);

  return (
    <Canvas
      shadows={false} // tanpa bayangan sama sekali (shadow map paling mahal saat ramai) — demi performa
      dpr={high ? [1, 1.5] : 1}
      gl={{ antialias: false }}
      camera={{ position: [0, 12, 20], fov: 45 }}
      onCreated={(state) => {
        const { gl } = state;
        gl.info.autoReset = false;
        // Dev: akses scene dari konsol/skrip ukur (window.__vo.three).
        if (import.meta.env.DEV) Object.assign((window as unknown as { __vo?: object }).__vo ?? {}, { three: state });
        setReady(true);
      }}
    >
      {/* FPS turun terus → otomatis pindah ke mode ringan */}
      <PerformanceMonitor onDecline={() => useGraphics.getState().quality === "high" && useGraphics.getState().setQuality("low")} />
      {flat && <OrthographicCamera makeDefault position={[0, 40, 30]} zoom={28} near={0.1} far={300} />}
      <FpsMeter />
      <color attach="background" args={[BG]} />
      {!flat && <fog attach="fog" args={[BG, 40, 80]} />}
      <Lighting flat={flat} />
      {ready && (
        <Suspense fallback={null}>
          <Physics gravity={[0, -20, 0]} timeStep="vary">
            <World />
            <Player />
          </Physics>
          {Object.values(players)
            .filter((p) => p.floor === floor) // hanya orang di lantai yang sama
            .map((p) => (
            <RemotePlayer key={p.id} info={p} />
          ))}
        </Suspense>
      )}
      <Effects high={high} flat={flat} />
    </Canvas>
  );
}
