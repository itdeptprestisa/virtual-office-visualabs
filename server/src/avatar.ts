// Validasi konfigurasi avatar dari client. Sinkron dengan client/src/avatar/config.ts.

const OPTIONS: Record<string, readonly string[]> = {
  body: ["male", "female"],
  hair: ["none", "buzz", "short", "spiky", "curly", "bob", "long", "ponytail", "bun"],
  top: ["tshirt", "shirt", "hoodie", "suit"],
  bottom: ["pants", "shorts", "skirt"],
  glasses: ["none", "round", "square"],
  hat: ["none", "cap", "beanie"],
};

const DEFAULTS: Record<string, string | boolean> = {
  body: "male",
  skin: "#f5c9a0",
  hair: "short",
  hairColor: "#1f1a17",
  hijab: false,
  hijabColor: "#bb9af7",
  top: "shirt",
  topColor: "#7aa2f7",
  bottom: "pants",
  bottomColor: "#3b3f51",
  shoeColor: "#1f2335",
  glasses: "none",
  hat: "none",
};

const COLOR_KEYS = ["skin", "hairColor", "hijabColor", "topColor", "bottomColor", "shoeColor"];
const HEX = /^#[0-9a-f]{6}$/i;

export type Avatar = Record<string, string | boolean>;

export function sanitizeAvatar(raw: unknown): Avatar {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Avatar = { ...DEFAULTS };
  for (const [key, values] of Object.entries(OPTIONS)) {
    if (typeof src[key] === "string" && values.includes(src[key] as string)) out[key] = src[key] as string;
  }
  for (const key of COLOR_KEYS) {
    if (typeof src[key] === "string" && HEX.test(src[key] as string)) out[key] = src[key] as string;
  }
  out.hijab = src.hijab === true;
  return out;
}
