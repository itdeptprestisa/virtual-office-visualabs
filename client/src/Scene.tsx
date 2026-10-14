import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Physics } from "@react-three/rapier";
import { create } from "zustand";
import { World } from "./World";
import { Player } from "./Player";
import { RemotePlayer } from "./RemotePlayer";
import { useNet } from "./net";

type Quality = "high" | "low";

export const useGraphics = create<{ quality: Quality; fps: number; setQuality: (q: Quality) => void }>((set) => ({
  quality: "high",
  fps: 0,
  setQuality: (quality) => set({ quality }),
}));

// Hitung FPS nyata (dua kali per detik) untuk ditampilkan di HUD.
function FpsMeter() {
  const frames = useRef(0);
  const since = useRef(performance.now());
  useFrame(() => {
    frames.current++;
    const now = performance.now();
    if (now - since.current >= 500) {
      useGraphics.setState({ fps: Math.round((frames.current * 1000) / (now - since.current)) });
      frames.current = 0;
      since.current = now;
    }
  });
  return null;
}

const BG = "#d9cfc1";

// Cahaya lingkungan dibangkitkan dari "lampu" virtual (tanpa unduh HDR): jendela utara + plafon + lampu hangat.
function Lighting({ high }: { high: boolean }) {
  const shadowSize = high ? 2048 : 1024;
  return (
    <>
      <hemisphereLight args={["#ffffff", "#c9b89e", 0.35]} />
      <directionalLight
        position={[-12, 20, 8]}
        intensity={2.6}
        color="#fff3e0"
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
      <Environment resolution={128} frames={1} environmentIntensity={0.45}>
        <Lightformer form="rect" intensity={2.5} color="#e3f1ff" position={[0, 6, -16]} scale={[40, 6, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[40, 30, 1]} />
        <Lightformer form="circle" intensity={1.5} color="#ffd6a8" position={[14, 5, 10]} scale={6} />
      </Environment>
    </>
  );
}

function Effects({ high }: { high: boolean }) {
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
      <N8AO halfRes aoRadius={1.2} distanceFalloff={0.6} intensity={2.2} color="#3b2f27" />
      <Bloom mipmapBlur luminanceThreshold={0.9} intensity={0.45} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
      <Vignette offset={0.3} darkness={0.35} />
    </EffectComposer>
  );
}

export function Scene() {
  const players = useNet((s) => s.players);
  const high = useGraphics((s) => s.quality) === "high";

  return (
    <Canvas shadows="percentage" dpr={high ? [1, 1.5] : 1} gl={{ antialias: false }} camera={{ position: [0, 12, 20], fov: 45 }}>
      {/* FPS turun terus → otomatis pindah ke mode ringan */}
      <PerformanceMonitor onDecline={() => useGraphics.getState().setQuality("low")} />
      <FpsMeter />
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 40, 80]} />
      <Lighting high={high} />
      <Suspense fallback={null}>
        <Physics gravity={[0, -20, 0]} timeStep="vary">
          <World />
          <Player />
        </Physics>
        {Object.values(players).map((p) => (
          <RemotePlayer key={p.id} info={p} />
        ))}
      </Suspense>
      <Effects high={high} />
    </Canvas>
  );
}
