import { create } from "zustand";
import { EN } from "./i18n.en";

// Terjemahan UI. Kunci = teks bahasa Indonesia (bahasa sumber), jadi teks yang belum diterjemahkan tetap tampil
// dalam bahasa Indonesia. Variabel ditulis {nama} dan diisi lewat argumen kedua t().

export type Lang = "id" | "en";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem("vo-lang");
    if (saved === "id" || saved === "en") return saved;
  } catch {
    /* mode privat */
  }
  return navigator.language?.toLowerCase().startsWith("id") ? "id" : "en";
}

export const useLang = create<{ lang: Lang }>(() => ({ lang: initialLang() }));

export function setLang(lang: Lang) {
  useLang.setState({ lang });
  document.documentElement.lang = lang;
  try {
    localStorage.setItem("vo-lang", lang);
  } catch {
    /* mode privat */
  }
}
document.documentElement.lang = useLang.getState().lang;

type Vars = Record<string, string | number>;

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s);

// Teks dari server (alasan gagal login, pemberitahuan) yang memuat bagian dinamis.
const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Bentrok dengan "(.+)" oleh (.+)\.$/, (m) => `Clashes with "${m[1]}" by ${m[2]}.`],
  [/^Meja (\d+)$/, (m) => `Desk ${m[1]}`],
  [/^Pintu (.+)$/, (m) => `${t(m[1])} door`],
  [/^Lantai (\d+)$/, (m) => `Floor ${m[1]}`],
  [/^Ruang (\d+)$/, (m) => `Room ${m[1]}`],
  [/^Area (\d+)$/, (m) => `Area ${m[1]}`],
];

/** Terjemahkan teks (bahasa aktif saat dipanggil). */
export function t(key: string, vars?: Vars): string {
  if (useLang.getState().lang === "id") return fill(key, vars);
  const direct = EN[key];
  if (direct !== undefined) return fill(direct, vars);
  for (const [re, out] of PATTERNS) {
    const m = key.match(re);
    if (m) return out(m);
  }
  return fill(key, vars);
}

/** Hook untuk komponen: render ulang saat bahasa diganti. */
export function useT() {
  useLang((s) => s.lang);
  return t;
}

/** Nama tempat dari data (mis. "Meja 3", "Lantai 2") ikut diterjemahkan bila polanya dikenal. */
export const place = (name: string | null | undefined) => (name ? t(name) : name ?? "");

/** Format waktu sesuai bahasa. */
export const locale = () => (useLang.getState().lang === "id" ? "id-ID" : "en-GB");
