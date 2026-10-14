// Konfigurasi avatar. Daftar pilihan & aturan validasi harus sinkron dengan server/src/avatar.ts.

export const OPTIONS = {
  body: ["male", "female"],
  hair: ["none", "buzz", "short", "spiky", "curly", "bob", "long", "ponytail", "bun"],
  top: ["tshirt", "shirt", "hoodie", "suit"],
  bottom: ["pants", "shorts", "skirt"],
  glasses: ["none", "round", "square"],
  hat: ["none", "cap", "beanie"],
} as const;

type Opt<K extends keyof typeof OPTIONS> = (typeof OPTIONS)[K][number];

export interface AvatarConfig {
  body: Opt<"body">;
  skin: string;
  hair: Opt<"hair">;
  hairColor: string;
  hijab: boolean;
  hijabColor: string;
  top: Opt<"top">;
  topColor: string;
  bottom: Opt<"bottom">;
  bottomColor: string;
  shoeColor: string;
  glasses: Opt<"glasses">;
  hat: Opt<"hat">;
}

export const COLOR_KEYS = ["skin", "hairColor", "hijabColor", "topColor", "bottomColor", "shoeColor"] as const;

export const LABELS: Record<string, string> = {
  male: "Pria",
  female: "Wanita",
  none: "Tidak ada",
  yes: "Pakai",
  buzz: "Cepak",
  short: "Pendek",
  spiky: "Jabrik",
  curly: "Keriting",
  bob: "Bob",
  long: "Panjang",
  ponytail: "Kuncir",
  bun: "Cepol",
  tshirt: "Kaos",
  shirt: "Kemeja",
  hoodie: "Hoodie",
  suit: "Jas",
  pants: "Celana panjang",
  shorts: "Celana pendek",
  skirt: "Rok",
  round: "Bulat",
  square: "Kotak",
  cap: "Topi",
  beanie: "Kupluk",
};

export const SKIN_TONES = ["#ffe0c4", "#f5c9a0", "#e0a878", "#c68a5a", "#9a6440", "#6b4429"];
export const HAIR_COLORS = ["#1f1a17", "#4a3123", "#7b4a2a", "#c08a4a", "#e6c27a", "#b8b8b8", "#c0392b", "#6c5ce7"];
export const CLOTH_COLORS = [
  "#f7768e", "#ff9e64", "#e0af68", "#9ece6a", "#73daca",
  "#7aa2f7", "#bb9af7", "#f5f5f5", "#8a8f9e", "#3b3f51", "#1f2335", "#6b4f3a",
];

export const DEFAULT_AVATAR: AvatarConfig = {
  body: "male",
  skin: SKIN_TONES[1],
  hair: "short",
  hairColor: HAIR_COLORS[0],
  hijab: false,
  hijabColor: CLOTH_COLORS[6],
  top: "shirt",
  topColor: CLOTH_COLORS[5],
  bottom: "pants",
  bottomColor: CLOTH_COLORS[9],
  shoeColor: CLOTH_COLORS[10],
  glasses: "none",
  hat: "none",
};

const HEX = /^#[0-9a-f]{6}$/i;
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

export function sanitizeAvatar(raw: unknown): AvatarConfig {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...DEFAULT_AVATAR };
  for (const key of Object.keys(OPTIONS) as (keyof typeof OPTIONS)[]) {
    if ((OPTIONS[key] as readonly unknown[]).includes(src[key])) out[key] = src[key];
  }
  for (const key of COLOR_KEYS) {
    if (typeof src[key] === "string" && HEX.test(src[key] as string)) out[key] = src[key];
  }
  out.hijab = src.hijab === true;
  return out as unknown as AvatarConfig;
}

export function randomAvatar(): AvatarConfig {
  const body = pick(OPTIONS.body);
  const female = body === "female";
  return {
    body,
    skin: pick(SKIN_TONES),
    hair: female ? pick(["long", "bob", "ponytail", "bun", "curly"] as const) : pick(["buzz", "short", "spiky", "curly"] as const),
    hairColor: pick(HAIR_COLORS.slice(0, 6)),
    hijab: female && Math.random() < 0.3,
    hijabColor: pick(CLOTH_COLORS),
    top: pick(OPTIONS.top),
    topColor: pick(CLOTH_COLORS),
    bottom: female ? pick(OPTIONS.bottom) : pick(["pants", "shorts"] as const),
    bottomColor: pick(CLOTH_COLORS.slice(7)),
    shoeColor: pick(CLOTH_COLORS),
    glasses: Math.random() < 0.3 ? pick(["round", "square"] as const) : "none",
    hat: "none",
  };
}
