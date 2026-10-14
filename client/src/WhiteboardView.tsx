import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { clearBoard, drawStroke, paint, useWhiteboard, type Stroke } from "./whiteboard";
import { useNet } from "./net";

const TEX_W = 1024;
const TEX_H = 552; // rasio 2,6 × 1,4

/** Permukaan whiteboard 3D: coretan ruangan ini, hanya terlihat oleh orang di dalam ruangan. */
export function WhiteboardMaterial({ room }: { room: string | null }) {
  const inside = useNet((s) => !!room && s.zoneId === `room:${room}`);
  const strokes = useWhiteboard((s) => (room ? s.boards[room] : undefined));
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return { canvas, texture };
  }, []);

  useEffect(() => {
    const ctx = canvas.getContext("2d")!;
    paint(ctx, inside ? (strokes ?? []) : [], TEX_W, TEX_H);
    if (!inside) {
      ctx.fillStyle = "#9aa1ad";
      ctx.font = "28px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Masuk ruangan untuk melihat whiteboard", TEX_W / 2, TEX_H / 2);
    }
    texture.needsUpdate = true;
  }, [inside, strokes, canvas, texture]);

  useEffect(() => () => texture.dispose(), [texture]);
  return <meshBasicMaterial map={texture} toneMapped={false} />;
}

const COLORS = ["#1f2335", "#e5484d", "#2f80ed", "#27ae60", "#f2994a", "#9b51e0"];
const ERASER = "#ffffff";

/** Jendela menggambar whiteboard bersama (orang di ruangan yang sama melihat coretan secara langsung). */
export function WhiteboardModal() {
  const room = useWhiteboard((s) => s.open);
  const strokes = useWhiteboard((s) => (room ? s.boards[room] : undefined));
  const roomName = useNet((s) => s.layout?.rooms.find((r) => r.id === room)?.name ?? "Whiteboard");
  const inside = useNet((s) => !!room && s.zoneId === `room:${room}`);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = useRef<Stroke | null>(null);
  const lastSend = useRef(0);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(6);

  // Keluar ruangan → whiteboard ditutup (yang di luar ruangan tidak boleh melihat).
  useEffect(() => {
    if (room && !inside) useWhiteboard.setState({ open: null });
  }, [room, inside]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    paint(cv.getContext("2d")!, strokes ?? [], cv.width, cv.height);
  }, [strokes]);

  if (!room) return null;
  const close = () => useWhiteboard.setState({ open: null });

  const point = (e: RPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const down = (e: RPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const w = color === ERASER ? width * 4 : width;
    current.current = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, color, width: w, pts: point(e) };
    drawStroke(room, current.current);
  };
  const move = (e: RPointerEvent<HTMLCanvasElement>) => {
    const s = current.current;
    if (!s) return;
    const [x, y] = point(e);
    s.pts = [...s.pts, Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000];
    // Kirim berkala supaya orang lain melihat coretan saat sedang digambar.
    const now = performance.now();
    if (now - lastSend.current > 60) {
      lastSend.current = now;
      drawStroke(room, { ...s });
    } else {
      const cv = canvasRef.current!;
      paint(cv.getContext("2d")!, [...(strokes ?? []).filter((x) => x.id !== s.id), s], cv.width, cv.height);
    }
  };
  const up = () => {
    if (current.current) drawStroke(room, { ...current.current });
    current.current = null;
  };

  return (
    <div className="overlay modal" onKeyDown={(e) => e.key === "Escape" && close()}>
      <div className="wb">
        <div className="wb-head">
          <b>📝 {roomName}</b>
          <div className="wb-tools">
            {COLORS.map((c) => (
              <button key={c} className={c === color ? "swatch active" : "swatch"} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Warna ${c}`} />
            ))}
            <button className={color === ERASER ? "chip active" : "chip"} onClick={() => setColor(ERASER)}>
              Penghapus
            </button>
            <select value={width} onChange={(e) => setWidth(Number(e.target.value))} aria-label="Tebal garis">
              <option value={3}>Tipis</option>
              <option value={6}>Sedang</option>
              <option value={12}>Tebal</option>
            </select>
            <button className="chip" onClick={() => confirm("Hapus semua coretan untuk semua orang?") && clearBoard(room)}>
              Bersihkan
            </button>
            <button className="secondary" onClick={close}>
              Tutup
            </button>
          </div>
        </div>
        <canvas ref={canvasRef} width={1600} height={862} className="wb-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      </div>
    </div>
  );
}
