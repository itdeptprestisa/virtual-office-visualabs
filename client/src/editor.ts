import { create } from "zustand";
import { ITEM_TYPES, WORLD, type Area, type Floor, type ItemType, type Layout, type Quarter, type Room } from "../../shared/layout";
import { applyLayout, sendLayout, setFloorLocal, useNet } from "./net";

// Editor denah (admin): pilih/geser/putar/hapus furnitur, ubah ruangan, area & lantai. Perubahan langsung
// diterapkan lokal lalu dikirim ke server (yang memvalidasi, menyimpan, dan menyiarkan ke semua orang).
// Semua operasi berlaku untuk lantai yang sedang dibuka.

interface EditorState {
  active: boolean;
  selected: string | null;
  drag: { id: string; x: number; z: number } | null; // posisi sementara saat digeser
}

export const useEditor = create<EditorState>(() => ({ active: false, selected: null, drag: null }));

export const SNAP = 0.25;
export const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const clampX = (x: number) => Math.max(WORLD.minX + 0.3, Math.min(WORLD.maxX - 0.3, x));
const clampZ = (z: number) => Math.max(WORLD.minZ + 0.3, Math.min(WORLD.maxZ - 0.3, z));

let sendTimer: ReturnType<typeof setTimeout> | null = null;

function commit(next: Layout) {
  applyLayout(next);
  if (sendTimer) clearTimeout(sendTimer);
  sendTimer = setTimeout(() => sendLayout(useNet.getState().layout!), 250);
}

const layout = () => useNet.getState().layout!;
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Ubah lantai yang sedang dibuka. */
function updateFloor(fn: (f: Floor) => Floor) {
  const l = layout();
  const id = useNet.getState().floor;
  commit({ ...l, floors: l.floors.map((f) => (f.id === id ? fn(f) : f)) });
}

export function moveItem(id: string, x: number, z: number) {
  updateFloor((f) => ({ ...f, items: f.items.map((it) => (it.id === id ? { ...it, x: clampX(snap(x)), z: clampZ(snap(z)) } : it)) }));
}

export function rotateItem(id: string) {
  updateFloor((f) => ({ ...f, items: f.items.map((it) => (it.id === id ? { ...it, rot: ((it.rot + 1) % 4) as Quarter } : it)) }));
}

export function deleteItem(id: string) {
  updateFloor((f) => ({ ...f, items: f.items.filter((it) => it.id !== id) }));
  useEditor.setState({ selected: null });
}

export function addItem(type: ItemType, x: number, z: number) {
  if (!ITEM_TYPES.includes(type)) return;
  const id = uid("i");
  updateFloor((f) => ({ ...f, items: [...f.items, { id, type, x: clampX(snap(x)), z: clampZ(snap(z)), rot: 0 }] }));
  useEditor.setState({ selected: id });
}

export function updateRoom(id: string, patch: Partial<Room>) {
  updateFloor((f) => ({ ...f, rooms: f.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
}

export function addRoom(x: number, z: number) {
  const cx = snap(clampX(x));
  const cz = snap(clampZ(z));
  updateFloor((f) => ({
    ...f,
    rooms: [
      ...f.rooms,
      { id: uid("r"), name: `Ruang ${f.rooms.length + 1}`, x: [cx - 2, cx + 2], z: [cz - 2, cz + 2], door: { side: "s", center: cx, width: 1.6 }, color: "#8b7cf6" },
    ],
  }));
}

export function deleteRoom(id: string) {
  updateFloor((f) => ({ ...f, rooms: f.rooms.filter((r) => r.id !== id) }));
}

export function updateArea(id: string, patch: Partial<Area>) {
  updateFloor((f) => ({ ...f, areas: f.areas.map((a) => (a.id === id ? ({ ...a, ...patch } as Area) : a)) }));
}

export function addArea(x: number, z: number, stage = false) {
  updateFloor((f) => ({
    ...f,
    areas: [
      ...f.areas,
      stage
        ? { id: uid("a"), name: "Panggung", color: "#f2994a", stage: true, shape: "rect", x: [snap(x) - 2.5, snap(x) + 2.5], z: [snap(z) - 1.5, snap(z) + 1.5] }
        : { id: uid("a"), name: `Area ${f.areas.length + 1}`, color: "#4fae7d", shape: "circle", cx: snap(x), cz: snap(z), r: 3 },
    ],
  }));
}

export function deleteArea(id: string) {
  updateFloor((f) => ({ ...f, areas: f.areas.filter((a) => a.id !== id) }));
}

// ----- lantai -----

export function addFloor() {
  const l = layout();
  const id = uid("f");
  // Lantai baru langsung punya lift supaya bisa dicapai.
  const floor: Floor = { id, name: `Lantai ${l.floors.length + 1}`, rooms: [], areas: [], items: [{ id: uid("i"), type: "elevator", x: 16.9, z: 11.9, rot: 2 }] };
  commit({ ...l, floors: [...l.floors, floor] });
}

export function renameFloor(id: string, name: string) {
  const l = layout();
  if (!name.trim()) return;
  commit({ ...l, floors: l.floors.map((f) => (f.id === id ? { ...f, name: name.slice(0, 40) } : f)) });
}

export function deleteFloor(id: string) {
  const l = layout();
  if (l.floors.length <= 1) return;
  const rest = l.floors.filter((f) => f.id !== id);
  if (useNet.getState().floor === id) setFloorLocal(rest[0].id);
  commit({ ...l, floors: rest });
}
