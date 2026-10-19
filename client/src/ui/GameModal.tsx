import { useEffect, useRef, useState } from "react";
import { useNet } from "../net";
import { C4_COLS, C4_ROWS } from "../../../shared/connect4";
import { c4DropAt, c4Join, c4Leave, c4Reset, closeGame, submitScore, useGames, type ScoreEntry } from "../games";
import { useT } from "../i18n";
import { CirclesFourIcon, JoystickIcon, TrophyIcon } from "./icons";

// Jendela game Lantai 2. Selama terbuka, semua tombol keyboard ditangkap di sini (tidak menggerakkan avatar,
// tidak memicu pintasan lain); Esc menutup.

export function GameModal() {
  const t = useT();
  const open = useGames((s) => s.open);
  const nearId = useNet((s) => s.nearGame?.id ?? null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    box.current?.focus(); // memicu focusin → tombol yang sedang ditahan (mis. W) dilepas
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return;
      e.stopPropagation();
      if (e.code === "Escape") closeGame();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  // Pindah lantai / dipanggil orang → jauh dari mesin, jendela ditutup.
  useEffect(() => {
    if (open && nearId !== open.id) closeGame();
  }, [open, nearId]);

  if (!open) return null;
  return (
    <div className="overlay modal">
      <div className="card game" ref={box} tabIndex={-1}>
        <div className="side-head">
          <h2>
            {open.type === "arcade" ? <JoystickIcon /> : <CirclesFourIcon />} {open.type === "arcade" ? "Snake" : t("Empat Sejajar")}
          </h2>
          <button className="x" onClick={closeGame} aria-label={t("Tutup")} title={t("Tutup")}>
            ×
          </button>
        </div>
        {open.type === "arcade" ? <Snake machine={open.id} /> : <ConnectFour table={open.id} />}
      </div>
    </div>
  );
}

// ---------- Snake ----------

const NO_SCORES: ScoreEntry[] = []; // referensi tetap: `?? []` di selector memicu render tanpa henti
const GRID = 20;
const CELL = 18;
type Pt = [number, number];
const DIRS: Record<string, Pt> = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

function Snake({ machine }: { machine: string }) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "playing" | "over">("ready");
  const [score, setScore] = useState(0);
  const game = useRef({ snake: [[10, 10]] as Pt[], dir: [1, 0] as Pt, next: [1, 0] as Pt, food: [15, 10] as Pt, score: 0 });
  const top = useGames((s) => s.scores.snake ?? NO_SCORES);
  const selfId = useNet((s) => s.selfId);
  const best = top.find((e) => e.userId === selfId)?.score;

  const draw = () => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const g = game.current;
    ctx.fillStyle = "#0b1a0f";
    ctx.fillRect(0, 0, GRID * CELL, GRID * CELL);
    ctx.fillStyle = "#ff5fa2";
    ctx.beginPath();
    ctx.arc(g.food[0] * CELL + CELL / 2, g.food[1] * CELL + CELL / 2, CELL / 2.6, 0, Math.PI * 2);
    ctx.fill();
    g.snake.forEach(([x, y], i) => {
      ctx.fillStyle = i === 0 ? "#8cf5a8" : "#3dd36b";
      ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    });
  };

  const placeFood = () => {
    const g = game.current;
    for (;;) {
      const f: Pt = [Math.floor(Math.random() * GRID), Math.floor(Math.random() * GRID)];
      if (!g.snake.some(([x, y]) => x === f[0] && y === f[1])) return (g.food = f);
    }
  };

  const start = (dir: Pt = [1, 0]) => {
    game.current = { snake: [[10, 10], [9, 10], [8, 10]], dir, next: dir, food: [15, 10], score: 0 };
    if (dir[0] === -1) game.current.snake = [[10, 10], [11, 10], [12, 10]]; // jangan langsung menabrak ekor sendiri
    placeFood();
    setScore(0);
    setPhase("playing");
  };

  const turn = (d: Pt) => {
    const g = game.current;
    if (d[0] !== -g.dir[0] || d[1] !== -g.dir[1]) g.next = d;
  };

  // Keyboard: panah / WASD. Saat belum main, tombol arah langsung memulai.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = DIRS[e.code];
      if (!d) return;
      e.preventDefault();
      if (phase === "playing") turn(d);
      else start(d);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase]);

  useEffect(draw, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const g = game.current;
      g.dir = g.next;
      const head: Pt = [g.snake[0][0] + g.dir[0], g.snake[0][1] + g.dir[1]];
      const hitWall = head[0] < 0 || head[1] < 0 || head[0] >= GRID || head[1] >= GRID;
      const eat = head[0] === g.food[0] && head[1] === g.food[1];
      const body = eat ? g.snake : g.snake.slice(0, -1);
      if (hitWall || body.some(([x, y]) => x === head[0] && y === head[1])) {
        setPhase("over");
        if (g.score > 0) submitScore(machine, g.score);
        return;
      }
      g.snake = [head, ...body];
      if (eat) {
        g.score++;
        setScore(g.score);
        placeFood();
      }
      draw();
      timer = setTimeout(tick, Math.max(70, 140 - g.score * 3)); // makin panjang makin cepat
    };
    timer = setTimeout(tick, 140);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="snake">
      <div className="snake-play">
        <canvas ref={canvas} width={GRID * CELL} height={GRID * CELL} className="snake-canvas" />
        {phase !== "playing" && (
          <div className="snake-cover">
            {phase === "over" && <b>{t("Skor: {n}", { n: score })}</b>}
            <button className="pill clickable accent" onClick={() => start()}>
              {phase === "over" ? t("Main lagi") : t("Mulai")}
            </button>
            <span className="small">{t("Panah / WASD untuk belok")}</span>
          </div>
        )}
        <div className="snake-pad">
          {(["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"] as const).map((k) => (
            <button key={k} className={`pill clickable pad-${k}`} onClick={() => (phase === "playing" ? turn(DIRS[k]) : start(DIRS[k]))}>
              {{ ArrowUp: "▲", ArrowLeft: "◀", ArrowDown: "▼", ArrowRight: "▶" }[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="scoreboard">
        <div className="muted small">
          {t("Skor")}: <b>{score}</b>
          {best !== undefined && ` · ${t("Terbaikmu")}: ${best}`}
        </div>
        <h4>
          <TrophyIcon /> {t("Papan skor")}
        </h4>
        <ol>
          {top.length === 0 && <li className="muted">{t("Belum ada skor. Jadilah yang pertama!")}</li>}
          {top.map((e) => (
            <li key={e.userId} className={e.userId === selfId ? "me" : ""}>
              <span>{e.name}</span>
              <b>{e.score}</b>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ---------- Empat Sejajar ----------

const PIECE = ["", "red", "yellow"];

function ConnectFour({ table }: { table: string }) {
  const t = useT();
  const g = useGames((s) => s.c4[table]);
  const selfId = useNet((s) => s.selfId);
  const [hover, setHover] = useState<number | null>(null);
  if (!g) return <p className="muted">{t("Memuat…")}</p>;

  const mySeat = g.seats.findIndex((p) => p?.id === selfId);
  const ready = !!g.seats[0] && !!g.seats[1];
  const myTurn = ready && !g.result && mySeat === g.turn - 1;
  const nameOf = (piece: number) => g.seats[piece - 1]?.name ?? "?";
  const status =
    g.result === 3
      ? t("Seri! Papan penuh.")
      : g.result
        ? t("{name} menang!", { name: nameOf(g.result) })
        : !ready
          ? t("Menunggu pemain kedua…")
          : myTurn
            ? t("Giliranmu — pilih kolom")
            : t("Giliran {name}", { name: nameOf(g.turn) });

  return (
    <div className="c4">
      <div className="c4-seats">
        {([0, 1] as const).map((i) => (
          <div key={i} className={`c4-seat ${g.turn === i + 1 && ready && !g.result ? "turn" : ""}`}>
            <span className={`c4-dot ${PIECE[i + 1]}`} />
            {g.seats[i] ? (
              <span>
                {g.seats[i]!.name}
                {i === mySeat && ` (${t("kamu")})`}
              </span>
            ) : mySeat < 0 ? (
              <button className="pill clickable accent" onClick={() => c4Join(table, i)}>
                {i === 0 ? t("Main sebagai merah") : t("Main sebagai kuning")}
              </button>
            ) : (
              <span className="muted">{t("Kursi kosong")}</span>
            )}
          </div>
        ))}
      </div>
      <p className="c4-status">{status}</p>
      <div className="c4-board" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: C4_ROWS * C4_COLS }, (_, i) => {
          const col = i % C4_COLS;
          const cls = [
            "c4-cell",
            PIECE[g.board[i]],
            g.line?.includes(i) ? "win" : "",
            g.last === i ? "last" : "",
            myTurn && hover === col ? "hover" : "",
          ].join(" ");
          return (
            <button
              key={i}
              className={cls}
              disabled={!myTurn}
              onMouseEnter={() => setHover(col)}
              onClick={() => c4DropAt(table, col)}
              aria-label={t("Kolom {n}", { n: col + 1 })}
            />
          );
        })}
      </div>
      {mySeat >= 0 ? (
        <div className="c4-actions">
          {g.result !== 0 && (
            <button className="pill clickable accent" onClick={() => c4Reset(table)}>
              {t("Main lagi")}
            </button>
          )}
          <button className="pill clickable" onClick={c4Leave}>
            {t("Tinggalkan meja")}
          </button>
        </div>
      ) : (
        ready && <p className="muted small">{t("Kamu sedang menonton.")}</p>
      )}
    </div>
  );
}
