import { create } from "zustand";
import { sendGame, useNet } from "./net";
import { gameInput } from "./input";

// Game di Lantai 2: mesin arcade (Snake, papan skor bersama) & meja Empat Sejajar (2 pemain, wasitnya server).

export interface ScoreEntry {
  userId: string;
  name: string;
  score: number;
  ts: number;
}

export interface C4State {
  table: string;
  board: number[];
  seats: ({ id: string; name: string } | null)[];
  turn: 1 | 2;
  result: 0 | 1 | 2 | 3;
  line: number[] | null;
  last: number | null;
}

export type OpenGame = { type: "arcade" | "gameTable"; id: string } | null;

interface GamesState {
  open: OpenGame; // mesin/meja yang jendelanya sedang dibuka
  scores: Record<string, ScoreEntry[]>;
  c4: Record<string, C4State>;
}

export const useGames = create<GamesState>(() => ({ open: null, scores: {}, c4: {} }));

export function onGameMessage(msg: any) {
  if (msg.t === "arcade_scores") useGames.setState((s) => ({ scores: { ...s.scores, [msg.game]: msg.top } }));
  else if (msg.t === "c4_state") useGames.setState((s) => ({ c4: { ...s.c4, [msg.table]: msg } }));
}

const GAME_RANGE = 1.9; // m dari pusat mesin/meja

/** Mesin arcade / meja game terdekat di lantai kita dalam jangkauan. */
export function gameNear(x: number, z: number): NonNullable<OpenGame> | null {
  const { layout, floor } = useNet.getState();
  let best: NonNullable<OpenGame> | null = null;
  let bestDist = GAME_RANGE;
  for (const it of layout?.floors.find((f) => f.id === floor)?.items ?? []) {
    if (it.type !== "arcade" && it.type !== "gameTable") continue;
    const d = Math.hypot(it.x - x, it.z - z);
    if (d <= bestDist) {
      bestDist = d;
      best = { type: it.type, id: it.id };
    }
  }
  return best;
}

export function openGame(game: NonNullable<OpenGame>) {
  gameInput.active = true; // tombol gerak tidak menggerakkan avatar selama main
  useGames.setState({ open: game });
  if (game.type === "arcade") sendGame({ t: "arcade_scores", game: "snake" });
  else sendGame({ t: "c4_open", table: game.id });
}

export function closeGame() {
  gameInput.active = false;
  useGames.setState({ open: null });
}

export const submitScore = (machine: string, score: number) => sendGame({ t: "arcade_score", game: "snake", machine, score });
export const c4Join = (table: string, seat: 0 | 1) => sendGame({ t: "c4_join", table, seat });
export const c4Leave = () => sendGame({ t: "c4_leave" });
export const c4DropAt = (table: string, col: number) => sendGame({ t: "c4_drop", table, col });
export const c4Reset = (table: string) => sendGame({ t: "c4_reset", table });
