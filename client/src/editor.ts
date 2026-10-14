import { create } from "zustand";
import { ITEM_TYPES, WORLD, type Area, type ItemType, type Layout, type Quarter, type Room } from "../../shared/layout";
import { applyLayout, sendLayout, useNet } from "./net";

// Editor denah (admin): pilih/geser/putar/hapus furnitur, ubah ruangan & area. Perubahan langsung diterapkan
// lokal lalu dikirim ke server (yang memvalidasi, menyimpan, dan menyiarkan ke semua orang).

interface EditorState {
  active: boolean;
  selected: string | null;
  drag: { id: string; x: number; z: number } | null; // posisi sementara saat digeser
}

export const useEditor = create<EditorState>(() => ({ active: false, selected: null, drag: null }));

export const SNAP = 0.25;
export const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const clampX = (x: number) => Math.max(-WORLD.halfW + 0.3, Math.min(WORLD.halfW - 0.3, x));
const clampZ = (z: number) => Math.max(-WORLD.halfD + 0.3, Math.min(WORLD.halfD - 0.3, z));

let sendTimer: ReturnType<typeof setTimeout> | null = null;

function commit(next: Layout) {
  applyLayout(next);
  if (sendTimer) clearTimeout(sendTimer);
  sendTimer = setTimeout(() => sendLayout(useNet.getState().layout!), 250);
}

const layout = () => useNet.getState().layout!;
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function moveItem(id: string, x: number, z: number) {
  const l = layout();
  commit({ ...l, items: l.items.map((it) => (it.id === id ? { ...it, x: clampX(snap(x)), z: clampZ(snap(z)) } : it)) });
}

export function rotateItem(id: string) {
  const l = layout();
  commit({ ...l, items: l.items.map((it) => (it.id === id ? { ...it, rot: (((it.rot + 1) % 4) as Quarter) } : it)) });
}

export function deleteItem(id: string) {
  const l = layout();
  commit({ ...l, items: l.items.filter((it) => it.id !== id) });
  useEditor.setState({ selected: null });
}

export function addItem(type: ItemType, x: number, z: number) {
  if (!ITEM_TYPES.includes(type)) return;
  const l = layout();
  const id = uid("i");
  commit({ ...l, items: [...l.items, { id, type, x: clampX(snap(x)), z: clampZ(snap(z)), rot: 0 }] });
  useEditor.setState({ selected: id });
}

export function updateRoom(id: string, patch: Partial<Room>) {
  const l = layout();
  commit({ ...l, rooms: l.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
}

export function addRoom(x: number, z: number) {
  const l = layout();
  const cx = snap(clampX(x));
  const cz = snap(clampZ(z));
  const room: Room = {
    id: uid("r"),
    name: `Ruang ${l.rooms.length + 1}`,
    x: [cx - 2, cx + 2],
    z: [cz - 2, cz + 2],
    door: { side: "s", center: cx, width: 1.6 },
    color: "#8b7cf6",
  };
  commit({ ...l, rooms: [...l.rooms, room] });
}

export function deleteRoom(id: string) {
  const l = layout();
  commit({ ...l, rooms: l.rooms.filter((r) => r.id !== id) });
}

export function updateArea(id: string, patch: Partial<Area>) {
  const l = layout();
  commit({ ...l, areas: l.areas.map((a) => (a.id === id ? ({ ...a, ...patch } as Area) : a)) });
}

export function addArea(x: number, z: number) {
  const l = layout();
  const area: Area = { id: uid("a"), name: `Area ${l.areas.length + 1}`, color: "#4fae7d", shape: "circle", cx: snap(x), cz: snap(z), r: 3 };
  commit({ ...l, areas: [...l.areas, area] });
}

export function deleteArea(id: string) {
  const l = layout();
  commit({ ...l, areas: l.areas.filter((a) => a.id !== id) });
}
