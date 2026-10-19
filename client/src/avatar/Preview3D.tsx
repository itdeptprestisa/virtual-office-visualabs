// Pratinjau avatar mode 3D (dimuat lazy supaya Three.js tidak terunduh di mode 2D).
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Character } from "./Character";
import type { AvatarConfig } from "./config";

export default function Preview3D({ config, anim }: { config: AvatarConfig; anim: number }) {
  return (
    <Canvas shadows="percentage" camera={{ position: [0, 1.2, 4.2], fov: 30 }} dpr={[1, 2]}>
      <color attach="background" args={["#e9ecef"]} />
      <hemisphereLight args={["#ffffff", "#c9b89e", 1.1]} />
      <directionalLight position={[2, 4, 3]} intensity={2.2} castShadow />
      <Character config={config} getAnim={() => anim} />
      <ContactShadows opacity={0.35} blur={2.2} far={2} />
      <OrbitControls target={[0, 0.95, 0]} enablePan={false} enableZoom={false} minPolarAngle={1.1} maxPolarAngle={1.7} />
    </Canvas>
  );
}
