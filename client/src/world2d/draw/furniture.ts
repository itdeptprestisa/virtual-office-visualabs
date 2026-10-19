import { angleOf, type Item, type ItemType } from "../../../../shared/layout";
import { PAL } from "../palette";
import { FONT, circ, rr, shade, shadowed } from "./prim";

type Fn = (g: CanvasRenderingContext2D, item: Item) => void;

const chairAt = (g: CanvasRenderingContext2D, col: string = PAL.chair, dark: string = PAL.chairDark) => {
  shadowed(g, () => rr(g, -0.27, -0.27, 0.54, 0.54, col, 0.14));
  rr(g, -0.27, -0.29, 0.54, 0.14, dark, 0.06); // sandaran di belakang (−y)
};

const table = (w: number, d: number, col: string = PAL.table) => (g: CanvasRenderingContext2D) => shadowed(g, () => rr(g, -w / 2, -d / 2, w, d, col, Math.min(w, d) * 0.15));

export const DRAW: Record<ItemType, Fn> = {
  desk: (g) => {
    shadowed(g, () => rr(g, -0.8, -0.4, 1.6, 0.8, PAL.deskTop, 0.06));
    rr(g, -0.8, 0.32, 1.6, 0.08, PAL.deskEdge, 0.03);
    rr(g, -0.36, -0.33, 0.72, 0.1, PAL.ink, 0.03);
    rr(g, -0.32, -0.31, 0.64, 0.05, PAL.screenGlow, 0.02);
    rr(g, -0.25, -0.05, 0.5, 0.14, "#e9e9ee", 0.03);
    circ(g, 0.42, 0.05, 0.07, "#ffffff");
    shadowed(g, () => circ(g, 0, 0.78, 0.27, PAL.task));
    rr(g, -0.25, 0.98, 0.5, 0.12, shade(PAL.task, 0.7), 0.05);
  },
  chair: (g) => chairAt(g),
  sofa: (g) => {
    shadowed(g, () => rr(g, -1.1, -0.45, 2.2, 0.9, PAL.sofa, 0.18));
    rr(g, -1.1, -0.45, 2.2, 0.22, PAL.sofaDark, 0.1);
    rr(g, -1.1, -0.45, 0.2, 0.9, PAL.sofaDark, 0.1);
    rr(g, 0.9, -0.45, 0.2, 0.9, PAL.sofaDark, 0.1);
    for (const x of [-0.45, 0.45]) rr(g, x - 0.42, -0.2, 0.84, 0.55, shade(PAL.sofa, 1.08), 0.1);
  },
  tableLarge: table(6, 2.2),
  tableSmall: table(1.6, 1),
  coffeeTable: (g) => shadowed(g, () => circ(g, 0, 0, 0.9, PAL.wood)),
  rug: (g) => {
    circ(g, 0, 0, 4, "#e9b8a6");
    g.strokeStyle = "#d89d88";
    g.lineWidth = 0.08;
    g.beginPath();
    g.arc(0, 0, 3.7, 0, Math.PI * 2);
    g.stroke();
  },
  plant: (g) => {
    shadowed(g, () => circ(g, 0, 0, 0.3, PAL.pot));
    [[-0.17, -0.12, 0.27], [0.17, -0.07, 0.25], [0, 0.12, 0.27], [0.02, -0.2, 0.21]].forEach(([x, y, r], i) => circ(g, x, y, r, PAL.leaf[i]));
  },
  reception: (g) => {
    shadowed(g, () => rr(g, -1.75, -0.4, 3.5, 0.8, PAL.wood, 0.12));
    rr(g, -1.8, -0.45, 3.6, 0.2, PAL.woodDark, 0.08);
    rr(g, -0.4, -0.35, 0.8, 0.1, PAL.ink, 0.03);
  },
  counter: (g) => {
    shadowed(g, () => rr(g, -1.5, -0.33, 3, 0.66, PAL.white, 0.06));
    rr(g, 0.3, -0.2, 0.6, 0.4, PAL.steel, 0.08);
    rr(g, -1.08, -0.22, 0.36, 0.3, "#2f3340", 0.05);
  },
  fridge: (g) => {
    shadowed(g, () => rr(g, -0.4, -0.35, 0.8, 0.7, "#e9edf2", 0.06));
    rr(g, 0.28, 0.0, 0.04, 0.3, PAL.steel, 0.02);
  },
  bookshelf: (g) => {
    shadowed(g, () => rr(g, -1, -0.2, 2, 0.4, PAL.woodDark, 0.04));
    const cols = ["#c0504d", "#4f81bd", "#9bbb59", "#e0a458", "#8064a2", "#4bacc6"];
    for (let i = 0; i < 12; i++) rr(g, -0.92 + i * 0.155, -0.15, 0.12, 0.28, cols[i % 6], 0.02);
  },
  screen: (g) => {
    rr(g, -2.48, -0.06, 4.95, 0.14, "#1b1d26", 0.03);
    rr(g, -2.4, 0.02, 4.8, 0.06, "#2d3550", 0.02);
  },
  whiteboard: (g) => {
    rr(g, -1.35, -0.05, 2.7, 0.12, PAL.steel, 0.03);
    rr(g, -1.3, 0.0, 2.6, 0.06, "#ffffff", 0.02);
  },
  podium: (g) => {
    shadowed(g, () => rr(g, -0.31, -0.23, 0.62, 0.46, PAL.woodDark, 0.06));
    rr(g, -0.35, -0.25, 0.7, 0.2, PAL.wood, 0.04);
    circ(g, 0.18, 0.12, 0.04, PAL.ink);
  },
  elevator: (g, item) => {
    shadowed(g, () => rr(g, -1.4, -2.5, 2.8, 2.5, "#cfd5dd", 0.06));
    rr(g, -1.2, -2.3, 2.4, 1.2, "#2f80ed", 0.06);
    g.save();
    g.translate(0, -1.68);
    g.rotate(angleOf(item.rot)); // tulisan tetap tegak berapa pun rotasi lift
    g.fillStyle = "#ffffff";
    g.font = `800 0.7px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("LIFT", 0, 0);
    g.restore();
    rr(g, -0.8, -0.08, 1.6, 0.12, "#7d8794", 0.03);
    rr(g, -0.78, -0.06, 0.76, 0.08, "#aab2bd", 0.02);
    rr(g, 0.02, -0.06, 0.76, 0.08, "#aab2bd", 0.02);
  },
  arcade: (g) => {
    shadowed(g, () => rr(g, -0.45, -0.45, 0.9, 0.8, "#3b2a63", 0.08));
    rr(g, -0.35, -0.35, 0.7, 0.4, "#0b1a0f", 0.04);
    rr(g, -0.3, -0.3, 0.6, 0.3, "#3dd36b", 0.03);
    rr(g, -0.45, 0.35, 0.9, 0.3, "#2a1d47", 0.06);
    circ(g, -0.2, 0.5, 0.05, "#e33");
    circ(g, 0.1, 0.5, 0.05, "#ffd23f");
    circ(g, 0.25, 0.5, 0.05, "#3fa7ff");
  },
  gameTable: (g) => {
    table(1.2, 0.9)(g);
    rr(g, -0.42, -0.04, 0.84, 0.08, "#2c5fd6", 0.02);
  },
  toilet: (g) => {
    for (const x of [-0.88, 0.88]) rr(g, x - 0.025, -0.95, 0.05, 1.9, "#9cb4cc", 0.02);
    shadowed(g, () => rr(g, -0.22, -0.95, 0.44, 0.18, PAL.white, 0.05));
    g.fillStyle = PAL.white;
    g.beginPath();
    g.ellipse(0, -0.5, 0.19, 0.24, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#cfd6de";
    g.lineWidth = 0.03;
    g.stroke();
  },
  sink: (g) => {
    shadowed(g, () => rr(g, -0.45, -0.25, 0.9, 0.5, PAL.white, 0.08));
    circ(g, 0, 0.02, 0.17, "#d8dee6");
    rr(g, -0.02, -0.22, 0.04, 0.12, PAL.steel, 0.01);
  },
  prayerMat: (g) => {
    rr(g, -0.37, -0.62, 0.74, 1.24, "#c9a227", 0.04);
    rr(g, -0.32, -0.57, 0.64, 1.14, "#2e7d5b", 0.03);
    g.fillStyle = "#c9a227";
    g.beginPath();
    g.arc(0, 0.38, 0.18, Math.PI, 0); // mihrab di ujung kiblat (+y)
    g.fill();
  },
  clock: (g) => {
    circ(g, 0, 0, 0.18, "#ffffff");
    g.strokeStyle = PAL.ink; g.lineWidth = 0.025;
    g.beginPath(); g.arc(0, 0, 0.18, 0, Math.PI * 2); g.moveTo(0, 0); g.lineTo(0, -0.11); g.moveTo(0, 0); g.lineTo(0.08, 0); g.stroke();
  },
  dispenser: (g) => { shadowed(g, () => rr(g, -0.2, -0.2, 0.4, 0.4, "#e8edf3", 0.06)); circ(g, 0, -0.02, 0.15, "#7fbfff"); circ(g, 0, -0.02, 0.08, "#b9dcff"); },
  frame: (g) => { rr(g, -0.6, -0.06, 1.2, 0.12, PAL.woodDark, 0.02); rr(g, -0.54, -0.04, 1.08, 0.08, "#8fb8d8", 0.01); },
  floorLamp: (g) => { shadowed(g, () => circ(g, 0, 0, 0.18, "#f3e2b8")); circ(g, 0, 0, 0.07, "#fff6d8"); },
  printer: (g) => { shadowed(g, () => rr(g, -0.35, -0.3, 0.7, 0.6, "#e6e8ec", 0.06)); rr(g, -0.25, -0.22, 0.5, 0.18, "#4a4f5a", 0.03); rr(g, -0.2, 0.1, 0.4, 0.12, "#ffffff", 0.02); },
  bin: (g) => { shadowed(g, () => circ(g, 0, 0, 0.17, "#6b7280")); circ(g, 0, 0, 0.12, "#3f444d"); },
  magazineRack: (g) => { shadowed(g, () => rr(g, -0.4, -0.15, 0.8, 0.3, PAL.woodDark, 0.04)); ["#e07a5f", "#3d6fd9", "#f2c14e", "#2e9e8f"].forEach((c, i) => rr(g, -0.36 + i * 0.19, -0.1, 0.16, 0.2, c, 0.02)); },
  window: (g) => { rr(g, -1.5, -0.08, 3, 0.16, PAL.frame, 0.02); rr(g, -1.44, -0.05, 2.88, 0.1, "#cfe8ff", 0.01); rr(g, -0.02, -0.08, 0.04, 0.16, PAL.frame, 0); },
  // ----- dekorasi gelombang kedua -----
  treePlant: (g) => {
    shadowed(g, () => circ(g, 0, 0.1, 0.36, PAL.pot));
    [[-0.32, -0.18, 0.42], [0.3, -0.12, 0.4], [0, 0.22, 0.42], [0.05, -0.4, 0.36], [-0.25, 0.25, 0.3]].forEach(([x, y, r], i) => circ(g, x, y, r, PAL.leaf[i % 4]));
    circ(g, -0.1, -0.2, 0.12, "#8fd19a");
  },
  rugRect: (g) => {
    rr(g, -2, -1.2, 4, 2.4, "#c9d8ea", 0.15);
    rr(g, -1.82, -1.02, 3.64, 2.04, "#e3ecf6", 0.1);
    g.strokeStyle = "#a9bfd8";
    g.lineWidth = 0.05;
    g.strokeRect(-1.6, -0.8, 3.2, 1.6);
  },
  playRug: (g) => {
    rr(g, -5, -3, 10, 6, "#f6e3b4", 0.4);
    const cols = ["#f28b82", "#fbbc04", "#81c995", "#78a9ff", "#c58af9"];
    for (let k = 0; k < 5; k++) rr(g, -4.6 + k * 1.86, -2.6, 1.6, 5.2, cols[k] + "55", 0.3);
    for (const [x, y, c] of [[-3, -1.6, "#f28b82"], [2.6, 1.4, "#78a9ff"], [0.4, -1.2, "#81c995"], [-1.6, 1.6, "#fbbc04"]] as const) circ(g, x, y, 0.35, c);
  },
  noticeBoard: (g) => {
    rr(g, -0.85, -0.09, 1.7, 0.18, "#b07a4a", 0.03);
    rr(g, -0.8, -0.06, 1.6, 0.12, "#d9a36b", 0.02);
    ["#fff3a8", "#bde0fe", "#ffc8dd", "#caffbf"].forEach((c, k) => rr(g, -0.7 + k * 0.38, -0.05, 0.26, 0.1, c, 0.01));
  },
  beanBag: (g) => {
    shadowed(g, () => {
      g.fillStyle = "#e07a5f";
      g.beginPath();
      g.ellipse(0, 0, 0.46, 0.42, 0, 0, Math.PI * 2);
      g.fill();
    });
    circ(g, 0, -0.16, 0.26, shade("#e07a5f", 0.85)); // sandaran
    circ(g, -0.12, 0.1, 0.1, "#f2a48d");
  },
  coffeeMachine: (g) => {
    shadowed(g, () => rr(g, -0.35, -0.3, 0.7, 0.6, "#3a3f4b", 0.08));
    rr(g, -0.25, -0.22, 0.5, 0.2, "#22262e", 0.04);
    circ(g, 0.15, -0.12, 0.04, "#7be495");
    circ(g, 0, 0.12, 0.1, "#ffffff");
    circ(g, 0, 0.12, 0.06, "#8a5a3b");
  },
  vending: (g) => {
    shadowed(g, () => rr(g, -0.5, -0.4, 1, 0.8, "#e5484d", 0.08));
    rr(g, -0.42, -0.32, 0.6, 0.62, "#cfe8ff", 0.04);
    const cols = ["#fbbc04", "#34a853", "#4285f4", "#ff6d01"];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) rr(g, -0.38 + c * 0.19, -0.28 + r * 0.2, 0.13, 0.14, cols[(r + c) % 4], 0.02);
    rr(g, 0.24, -0.3, 0.18, 0.3, "#b8343a", 0.03);
  },
  snackShelf: (g) => {
    shadowed(g, () => rr(g, -0.6, -0.2, 1.2, 0.4, PAL.wood, 0.04));
    const cols = ["#ff8a65", "#ffd54f", "#81c784", "#64b5f6", "#ba68c8", "#f06292"];
    for (let k = 0; k < 6; k++) rr(g, -0.54 + k * 0.18, -0.14, 0.14, 0.28, cols[k], 0.03);
  },
  barStool: (g) => {
    shadowed(g, () => circ(g, 0, 0, 0.22, "#4a4f5a"));
    circ(g, 0, 0, 0.17, "#e8833a");
  },
  hangingPlant: (g) => {
    g.strokeStyle = "rgba(90,70,50,.35)";
    g.lineWidth = 0.03;
    g.beginPath();
    g.arc(0, 0, 0.42, 0, Math.PI * 2);
    g.stroke();
    circ(g, 0, 0, 0.2, "#d9a36b");
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      circ(g, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.14, PAL.leaf[k % 4]);
    }
  },
  poster: (g) => {
    rr(g, -0.5, -0.07, 1, 0.14, "#2b2d3a", 0.02);
    rr(g, -0.46, -0.05, 0.3, 0.1, "#f28b82", 0.01);
    rr(g, -0.14, -0.05, 0.3, 0.1, "#fbbc04", 0.01);
    rr(g, 0.18, -0.05, 0.28, 0.1, "#78a9ff", 0.01);
  },
  wallShelf: (g) => {
    rr(g, -0.6, -0.12, 1.2, 0.24, PAL.woodDark, 0.03);
    circ(g, -0.38, 0, 0.08, "#81c995");
    rr(g, -0.18, -0.08, 0.3, 0.16, "#f6c177", 0.02);
    circ(g, 0.32, 0, 0.07, "#c58af9");
  },
  tv: (g) => {
    rr(g, -1, -0.08, 2, 0.16, "#15171d", 0.03);
    rr(g, -0.94, -0.04, 1.88, 0.08, "#4f8cff", 0.02);
  },
  logoBoard: (g) => {
    rr(g, -1.4, -0.1, 2.8, 0.2, "#2b3a67", 0.04);
    circ(g, -1.05, 0, 0.07, "#fbbc04");
    rr(g, -0.85, -0.03, 1.9, 0.06, "#ffffff", 0.02);
  },
  pingPong: (g) => {
    shadowed(g, () => rr(g, -1.37, -0.76, 2.74, 1.52, "#2e7d5b", 0.05));
    g.strokeStyle = "#ffffff";
    g.lineWidth = 0.04;
    g.strokeRect(-1.32, -0.71, 2.64, 1.42);
    g.beginPath();
    g.moveTo(-1.32, 0);
    g.lineTo(1.32, 0);
    g.stroke();
    rr(g, -0.03, -0.85, 0.06, 1.7, "#f4f1ec", 0.01); // net
    circ(g, 0.6, 0.3, 0.05, "#ff9f1c");
  },
  foosball: (g) => {
    shadowed(g, () => rr(g, -0.7, -0.4, 1.4, 0.8, "#6b4a2b", 0.06));
    rr(g, -0.6, -0.32, 1.2, 0.64, "#3fa34d", 0.03);
    for (let k = 0; k < 6; k++) {
      const x = -0.5 + k * 0.2;
      rr(g, x - 0.012, -0.5, 0.024, 1, "#c9ccd1", 0.01);
      circ(g, x, k % 2 ? 0.12 : -0.12, 0.05, k < 3 ? "#e5484d" : "#3d7be0");
    }
  },
  billiard: (g) => {
    shadowed(g, () => rr(g, -1.3, -0.75, 2.6, 1.5, "#7a4b2a", 0.1));
    rr(g, -1.15, -0.6, 2.3, 1.2, "#1f7a5a", 0.05);
    for (const [x, y] of [[-1.15, -0.6], [0, -0.6], [1.15, -0.6], [-1.15, 0.6], [0, 0.6], [1.15, 0.6]]) circ(g, x, y, 0.07, "#1a1a1a");
    for (const [c, x, y] of [["#fbbc04", 0.4, 0], ["#e5484d", 0.52, -0.07], ["#3d7be0", 0.52, 0.07], ["#ffffff", -0.5, 0]] as const) circ(g, x, y, 0.05, c);
  },
  prizeShelf: (g) => {
    shadowed(g, () => rr(g, -1, -0.25, 2, 0.5, PAL.woodDark, 0.05));
    const cols = ["#f28b82", "#fbbc04", "#81c995", "#78a9ff", "#c58af9", "#ff8fb1"];
    for (let k = 0; k < 6; k++) circ(g, -0.82 + k * 0.33, 0, 0.13, cols[k]);
    circ(g, -0.82, -0.08, 0.05, "#ffffff");
  },
};

/** Item tinggi: digambar ulang di atas avatar yang berdiri tepat di belakangnya (sebelah utaranya). */
export const TALL: ReadonlySet<ItemType> = new Set<ItemType>(["plant", "bookshelf", "fridge", "arcade", "floorLamp", "dispenser", "treePlant", "vending", "snackShelf", "coffeeMachine", "prizeShelf"]);

/**
 * Gambar satu item di posisinya. Rotasi three.js: dunia = (x·cos + z·sin, −x·sin + z·cos) untuk sudut θ;
 * di kanvas (x kanan, y = z ke bawah) itu sama dengan `rotate(−θ)`.
 */
export function drawItem(g: CanvasRenderingContext2D, item: Item) {
  g.save();
  g.translate(item.x, item.z);
  g.rotate(-angleOf(item.rot));
  DRAW[item.type](g, item);
  g.restore();
}
