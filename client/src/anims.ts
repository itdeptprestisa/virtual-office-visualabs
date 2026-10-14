// State animasi avatar — urutan = kode yang dikirim lewat jaringan (field `a`). Sinkron dengan ANIM_COUNT di server.
export const ANIM = { idle: 0, walk: 1, run: 2, wave: 3, thumbs: 4, dance: 5, sit: 6 } as const;

// Emote lewat tombol angka; durasi dalam detik, null = sampai avatar bergerak.
export const EMOTE_KEYS: Record<string, { anim: number; duration: number | null }> = {
  Digit1: { anim: ANIM.wave, duration: 1.83 },
  Digit2: { anim: ANIM.thumbs, duration: 1.58 },
  Digit3: { anim: ANIM.dance, duration: null },
};
