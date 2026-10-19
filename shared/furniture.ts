// Ukuran collider (setengah ukuran & posisi lokal) dan radius sorotan editor per jenis furnitur.
// Dipakai fisika 3D (Rapier) dan tabrakan 2D supaya keduanya sama persis.
import type { ItemType } from "./layout.js";

type V3 = [number, number, number];

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
  podium: { half: [0.32, 0.55, 0.25], pos: [0, 0.55, 0] },
  elevator: { half: [1.4, 1.5, 1.25], pos: [0, 1.5, -1.25] },
  arcade: { half: [0.45, 0.95, 0.4], pos: [0, 0.95, 0] },
  gameTable: { half: [0.6, 0.38, 0.45], pos: [0, 0.38, 0] },
  toilet: { half: [0.25, 0.4, 0.35], pos: [0, 0.4, -0.6] },
  sink: { half: [0.45, 0.45, 0.25], pos: [0, 0.45, 0] },
  dispenser: { half: [0.2, 0.6, 0.2], pos: [0, 0.6, 0] },
  printer: { half: [0.35, 0.45, 0.3], pos: [0, 0.45, 0] },
  bin: { half: [0.17, 0.2, 0.17], pos: [0, 0.2, 0] },
  floorLamp: { half: [0.18, 0.8, 0.18], pos: [0, 0.8, 0] },
  magazineRack: { half: [0.4, 0.5, 0.15], pos: [0, 0.5, 0] },
  treePlant: { half: [0.4, 1.2, 0.4], pos: [0, 1.2, 0] },
  coffeeMachine: { half: [0.35, 0.6, 0.3], pos: [0, 0.6, 0] },
  vending: { half: [0.5, 1, 0.4], pos: [0, 1, 0] },
  snackShelf: { half: [0.6, 0.9, 0.2], pos: [0, 0.9, 0] },
  pingPong: { half: [1.37, 0.38, 0.76], pos: [0, 0.38, 0] },
  foosball: { half: [0.7, 0.45, 0.4], pos: [0, 0.45, 0] },
  billiard: { half: [1.3, 0.4, 0.75], pos: [0, 0.4, 0] },
  prizeShelf: { half: [1, 1, 0.25], pos: [0, 1, 0] },
};

/** Radius kira-kira (untuk lingkaran sorotan di editor). */
export const FOOTPRINT: Record<ItemType, number> = {
  desk: 1.1, chair: 0.45, sofa: 1.3, tableLarge: 3.2, tableSmall: 1, coffeeTable: 1, rug: 4, plant: 0.5,
  reception: 1.9, counter: 1.6, fridge: 0.6, bookshelf: 1.1, screen: 2.5, whiteboard: 1.4, podium: 0.5, elevator: 1.9,
  arcade: 0.7, gameTable: 0.8, toilet: 1.1, sink: 0.6, prayerMat: 0.7,
  clock: 0.3, dispenser: 0.35, frame: 0.7, floorLamp: 0.3, printer: 0.5, bin: 0.25, magazineRack: 0.5, window: 1.6,
  treePlant: 0.7, rugRect: 2.3, noticeBoard: 0.9, beanBag: 0.5, coffeeMachine: 0.45, vending: 0.65, snackShelf: 0.7, barStool: 0.3,
  hangingPlant: 0.5, poster: 0.6, wallShelf: 0.7, tv: 1.1, logoBoard: 1.5, pingPong: 1.6, foosball: 0.85, billiard: 1.5,
  prizeShelf: 1.1, playRug: 5.8,
};
