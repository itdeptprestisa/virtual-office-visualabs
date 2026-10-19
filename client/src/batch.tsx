import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Matrix4, Mesh, Vector3, type BufferGeometry, type Group, type Material } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Penggabung mesh statis: furnitur & dinding tersusun dari banyak potongan kecil (tiap potongan = 1 draw call,
// ×2 dengan bayangan). Setelah dirender, semua potongan dengan material yang sama di satu petak lantai digabung
// menjadi satu mesh; potongan aslinya disembunyikan (tetap ada untuk collider & klik editor).
// Petak (CELL m) dipertahankan supaya bagian gedung di luar layar tetap bisa dilewati GPU (frustum culling).

const CELL = 34; // ± seperempat lantai per petak
const KEEP = ["position", "normal", "uv"];

function materialKey(m: Material): string | null {
  const a = m as Material & Record<string, any>;
  // Bertekstur (layar, papan nama, whiteboard) tidak digabung — kecuali tekstur statis bersama (serat kayu).
  if ((a.map && !a.map.userData?.batchable) || a.alphaMap || a.envMap) return null;
  const hex = (c: any) => (c?.getHexString ? c.getHexString() : "");
  return [m.type, hex(a.color), a.map?.uuid ?? "", a.roughness, a.metalness, hex(a.emissive), a.emissiveIntensity, m.transparent, m.opacity, a.flatShading, m.side, m.depthWrite, a.toneMapped].join("|");
}

export function Batched({ children, enabled = true, version }: { children: ReactNode; enabled?: boolean; version: unknown }) {
  const root = useRef<Group>(null);
  const [merged, setMerged] = useState<Mesh[]>([]);

  useLayoutEffect(() => {
    const g = root.current;
    if (!enabled || !g) return;
    g.updateMatrixWorld(true);
    const inv = g.matrixWorld.clone().invert();
    const local = new Matrix4();
    const p = new Vector3();
    const buckets = new Map<string, { mat: Material; geos: BufferGeometry[]; cast: boolean; receive: boolean }>();
    const hidden: Mesh[] = [];
    g.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || m.userData.batched || !m.visible || Array.isArray(m.material)) return;
      const mk = materialKey(m.material as Material);
      if (!mk) return;
      p.setFromMatrixPosition(m.matrixWorld);
      const key = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}|${mk}|${m.castShadow}|${m.receiveShadow}`;
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const name of Object.keys(geo.attributes)) if (!KEEP.includes(name)) geo.deleteAttribute(name);
      if (!KEEP.every((k) => geo.attributes[k])) return geo.dispose();
      geo.applyMatrix4(local.multiplyMatrices(inv, m.matrixWorld));
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { mat: (m.material as Material).clone(), geos: [], cast: m.castShadow, receive: m.receiveShadow }));
      b.geos.push(geo);
      hidden.push(m);
    });
    const meshes: Mesh[] = [];
    for (const b of buckets.values()) {
      const geo = mergeGeometries(b.geos);
      b.geos.forEach((x) => x.dispose());
      if (!geo) continue;
      const mesh = new Mesh(geo, b.mat);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      mesh.userData.batched = true;
      mesh.raycast = () => {}; // klik tetap ditangani mesh asli
      meshes.push(mesh);
    }
    hidden.forEach((m) => (m.visible = false));
    setMerged(meshes);
    return () => {
      hidden.forEach((m) => (m.visible = true));
      meshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as Material).dispose();
      });
      setMerged([]);
    };
  }, [enabled, version]);

  // Isi yang sudah digabung tidak bergerak, tapi tetap ribuan objek (potongan asli yang disembunyikan). three.js
  // menelusuri & menghitung ulang matriks semuanya tiap frame — terasa patah-patah saat CPU sibuk. Jadi setelah
  // digabung, matriks dihitung sekali lalu cabang ini dilewati; dibuka lagi saat isi berubah atau editor aktif.
  useLayoutEffect(() => {
    const g = root.current;
    if (!g || !enabled || merged.length === 0) return;
    g.updateMatrixWorld(true);
    g.updateMatrixWorld = () => {};
    return () => {
      delete (g as Partial<Group>).updateMatrixWorld; // kembali ke metode bawaan Object3D
    };
  }, [enabled, merged]);

  return (
    <group ref={root}>
      {children}
      {merged.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
    </group>
  );
}
