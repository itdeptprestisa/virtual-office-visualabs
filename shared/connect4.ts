// Aturan Empat Sejajar (Connect Four) — dipakai server (wasit) & client (tampilan).
// Papan 7 kolom × 6 baris, indeks = baris * 7 + kolom, baris 0 = paling atas. Isi sel: 0 kosong, 1 merah, 2 kuning.

export const C4_COLS = 7;
export const C4_ROWS = 6;

export type C4Piece = 1 | 2;
/** 0 = belum selesai, 1/2 = pemenang, 3 = seri (papan penuh). */
export type C4Result = 0 | 1 | 2 | 3;

export const c4Empty = () => new Array<number>(C4_COLS * C4_ROWS).fill(0);

/** Jatuhkan keping ke kolom; mengembalikan baris tempat keping berhenti, atau -1 bila kolom penuh/tidak sah. */
export function c4Drop(board: number[], col: number, piece: C4Piece): number {
  if (!Number.isInteger(col) || col < 0 || col >= C4_COLS) return -1;
  for (let row = C4_ROWS - 1; row >= 0; row--) {
    const i = row * C4_COLS + col;
    if (board[i] === 0) {
      board[i] = piece;
      return row;
    }
  }
  return -1;
}

/** Sel-sel yang membentuk empat sejajar (untuk disorot), atau null. */
export function c4Line(board: number[]): number[] | null {
  const at = (r: number, c: number) => (r >= 0 && r < C4_ROWS && c >= 0 && c < C4_COLS ? board[r * C4_COLS + c] : 0);
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      const p = at(r, c);
      if (!p) continue;
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        if ([1, 2, 3].every((k) => at(r + dr * k, c + dc * k) === p)) return [0, 1, 2, 3].map((k) => (r + dr * k) * C4_COLS + c + dc * k);
      }
    }
  }
  return null;
}

export function c4Result(board: number[]): C4Result {
  const line = c4Line(board);
  if (line) return board[line[0]] as C4Piece;
  return board.every((v) => v !== 0) ? 3 : 0;
}
