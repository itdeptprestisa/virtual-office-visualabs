// Pembatas percobaan sederhana di memori (jendela waktu tetap per kunci), untuk menahan tebak-tebakan password.
// Hilang saat server restart — cukup untuk satu instance; tidak perlu Redis.

export class Limiter {
  private hits = new Map<string, { n: number; until: number }>();

  constructor(
    private max: number,
    private windowMs: number,
  ) {}

  /** Sisa waktu blokir (ms) bila kunci sudah melewati batas, 0 bila masih boleh. */
  blocked(key: string, now = Date.now()) {
    const h = this.hits.get(key);
    if (!h || h.until <= now) return 0;
    return h.n >= this.max ? h.until - now : 0;
  }

  /** Catat satu percobaan. */
  hit(key: string, now = Date.now()) {
    const h = this.hits.get(key);
    if (!h || h.until <= now) this.hits.set(key, { n: 1, until: now + this.windowMs });
    else h.n++;
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  /** Buang catatan yang sudah kedaluwarsa (dipanggil berkala supaya memori tidak tumbuh terus). */
  prune(now = Date.now()) {
    for (const [k, h] of this.hits) if (h.until <= now) this.hits.delete(k);
  }
}

/** Pesan blokir; bentuknya dikenali client untuk diterjemahkan (lihat PATTERNS di client/src/i18n.ts). */
export const tooMany = (ms: number) => `Terlalu banyak percobaan. Coba lagi dalam ${Math.max(1, Math.ceil(ms / 60_000))} menit.`;
