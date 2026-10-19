import { BoxGeometry, BufferAttribute, CanvasTexture, CylinderGeometry, RepeatWrapping, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3, type BufferGeometry } from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// Bentuk dasar furnitur 3D: geometri disimpan & dipakai ulang per ukuran, material ditulis sebagai spesifikasi
// sederhana. Furnitur statis digabung oleh Batched per material, jadi bagian kecil tambahan tidak menambah draw call —
// yang bertambah hanya segitiga. Karena itu: sudut tumpul = satu talang miring (44 segitiga, bukan 108 milik
// RoundedBoxGeometry) dan bola bersegmen sedikit. Furnitur tidak menggambar bayangan real-time (pass bayangan untuk
// ratusan potongan terlalu berat); bayangan avatar & dinding tetap jatuh di atasnya.

type V3 = [number, number, number];

export type Mat = {
  color: string;
  rough?: number;
  metal?: number;
  map?: "wood";
  emissive?: string;
  ei?: number;
  opacity?: number;
  double?: boolean;
};

const geos = new Map<string, BufferGeometry>();
function cached(key: string, make: () => BufferGeometry) {
  let g = geos.get(key);
  if (!g) geos.set(key, (g = make()));
  return g;
}

let wood: CanvasTexture | null = null;
/** Serat kayu abu netral (diwarnai oleh `color` material), dibuat sekali & boleh digabung oleh Batched. */
function woodMap() {
  if (wood) return wood;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  const S = 256;
  ctx.canvas.width = S;
  ctx.canvas.height = S;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, S, S);
  // Pseudo-acak tetap supaya hasilnya sama tiap muat.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const y = rnd() * S;
    const a = 0.04 + rnd() * 0.1;
    ctx.strokeStyle = `rgba(90,60,30,${a})`;
    ctx.lineWidth = 0.6 + rnd() * 2.2;
    ctx.beginPath();
    for (let x = 0; x <= S; x += 8) {
      const yy = y + Math.sin((x / S) * Math.PI * 2 * (1 + rnd() * 0.3) + i) * 3;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  wood = new CanvasTexture(ctx.canvas);
  wood.colorSpace = SRGBColorSpace;
  wood.wrapS = wood.wrapT = RepeatWrapping;
  wood.anisotropy = 4;
  wood.userData.batchable = true;
  return wood;
}

function Material({ m }: { m: Mat }) {
  return (
    <meshStandardMaterial
      color={m.color}
      roughness={m.rough ?? 0.7}
      metalness={m.metal ?? 0}
      map={m.map === "wood" ? woodMap() : null}
      emissive={m.emissive ?? "#000000"}
      emissiveIntensity={m.ei ?? 0}
      transparent={m.opacity !== undefined}
      opacity={m.opacity ?? 1}
      depthWrite={m.opacity === undefined}
      side={m.double ? 2 : 0}
    />
  );
}

/** `shadow` = ikut menggambar bayangan real-time (bawaan tidak). */
type Common = { pos?: V3; rot?: V3; scale?: V3 | number; m: Mat; shadow?: boolean };


/** Kotak dengan rusuk & sudut terpotong miring (chamfer): 6 sisi + 12 talang + 8 segitiga sudut = 44 segitiga. */
function chamferBox(w: number, h: number, d: number, r: number) {
  const [x, y, z] = [w / 2, h / 2, d / 2];
  const pts: Vector3[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1])
        pts.push(
          new Vector3(sx * x, sy * (y - r), sz * (z - r)),
          new Vector3(sx * (x - r), sy * y, sz * (z - r)),
          new Vector3(sx * (x - r), sy * (y - r), sz * z),
        );
  const g = new ConvexGeometry(pts);
  // UV proyeksi kotak (1 satuan tekstur = 1 m) supaya serat kayu tetap jalan & Batched bisa menggabung.
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const [ax, ay, az] = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const [u, v] = ax >= ay && ax >= az ? [pos.getZ(i), pos.getY(i)] : ay >= az ? [pos.getX(i), pos.getZ(i)] : [pos.getX(i), pos.getY(i)];
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  return g;
}

/**
 * Kotak bersudut tumpul. `r` = jari-jari tumpul (0 = kotak biasa, untuk bagian kecil & banyak seperti buku).
 * `soft` = sudut benar-benar membulat & halus (bantal sofa) — lebih mahal, pakai hanya untuk benda yang sedikit.
 */
export function RBox({ size, r = 0.015, soft = false, pos, rot, scale, m, shadow }: Common & { size: V3; r?: number; soft?: boolean }) {
  const [w, h, d] = size;
  const rr = Math.min(r, Math.min(w, h, d) / 2 - 0.001);
  // Talang di bawah ±4 mm, atau pada bagian ramping (kaki, tiang, list — sisi tengahnya < 12 cm), tidak terlihat
  // dari kamera → kotak biasa (12 segitiga).
  const mid = [w, h, d].sort((p, q) => p - q)[1];
  const g = soft
    ? cached(`sb|${w}|${h}|${d}|${rr}`, () => new RoundedBoxGeometry(w, h, d, 2, rr))
    : rr > 0.004 && mid >= 0.12
      ? cached(`rb|${w}|${h}|${d}|${rr}`, () => chamferBox(w, h, d, rr))
      : cached(`b|${w}|${h}|${d}`, () => new BoxGeometry(w, h, d));
  return (
    <mesh geometry={g} position={pos} rotation={rot} scale={scale} castShadow={shadow} receiveShadow>
      <Material m={m} />
    </mesh>
  );
}

/** Silinder (r atas, r bawah). `open` = tanpa tutup (kap lampu, tempat sampah). */
export function Cyl({ r, r2 = r, h, seg, open = false, pos, rot, scale, m, shadow }: Common & { r: number; r2?: number; h: number; seg?: number; open?: boolean }) {
  // Segmen bawaan menurut ukuran: tiang & kaki ramping tidak butuh banyak sisi untuk terlihat bulat.
  seg ??= Math.max(r, r2) < 0.03 ? 6 : Math.max(r, r2) < 0.1 ? 8 : 12;
  const g = cached(`c|${r}|${r2}|${h}|${seg}|${open}`, () => new CylinderGeometry(r, r2, h, seg, 1, open));
  return (
    <mesh geometry={g} position={pos} rotation={rot} scale={scale} castShadow={shadow} receiveShadow>
      <Material m={m} />
    </mesh>
  );
}

/** Bola; pakai `scale` untuk elips (bantal, daun, bean bag). */
export function Ball({ r, seg, pos, rot, scale, m, shadow }: Common & { r: number; seg?: number }) {
  const s = typeof scale === "number" ? scale : scale ? Math.max(...scale) : 1;
  seg ??= r * s < 0.06 ? 8 : 12;
  const g = cached(`s|${r}|${seg}`, () => new SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.6))));
  return (
    <mesh geometry={g} position={pos} rotation={rot} scale={scale} castShadow={shadow} receiveShadow>
      <Material m={m} />
    </mesh>
  );
}

/** Cincin (pijakan kaki, bingkai jam, dudukan kloset). Default berbaring datar. */
export function Ring({ r, tube, seg = 20, arc = Math.PI * 2, pos, rot = [Math.PI / 2, 0, 0], scale, m, shadow }: Common & { r: number; tube: number; seg?: number; arc?: number }) {
  const g = cached(`t|${r}|${tube}|${seg}|${arc}`, () => new TorusGeometry(r, tube, 6, seg, arc));
  return (
    <mesh geometry={g} position={pos} rotation={rot} scale={scale} castShadow={shadow} receiveShadow>
      <Material m={m} />
    </mesh>
  );
}
