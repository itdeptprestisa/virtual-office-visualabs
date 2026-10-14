import { create } from "zustand";
import { sendWhiteboard } from "./net";

// Coretan whiteboard per ruangan. Hanya terisi untuk ruangan tempat kita berada (server tidak mengirim ke orang luar).

export interface Stroke {
  id: string;
  color: string;
  width: number;
  pts: number[]; // [x0,y0,x1,y1,...] 0..1
}

interface WbState {
  boards: Record<string, Stroke[]>;
  version: number;
  open: string | null; // id ruangan yang whiteboard-nya sedang dibuka
}

export const useWhiteboard = create<WbState>(() => ({ boards: {}, version: 0, open: null }));

function upsert(room: string, stroke: Stroke) {
  useWhiteboard.setState((s) => {
    const list = [...(s.boards[room] ?? [])];
    const i = list.findIndex((x) => x.id === stroke.id);
    if (i >= 0) list[i] = stroke;
    else list.push(stroke);
    return { boards: { ...s.boards, [room]: list }, version: s.version + 1 };
  });
}

export function onWhiteboardMessage(msg: any) {
  if (msg.t === "wb_state") useWhiteboard.setState((s) => ({ boards: { ...s.boards, [msg.room]: msg.strokes }, version: s.version + 1 }));
  else if (msg.t === "wb_stroke") upsert(msg.room, msg.stroke);
  else if (msg.t === "wb_clear") useWhiteboard.setState((s) => ({ boards: { ...s.boards, [msg.room]: [] }, version: s.version + 1 }));
}

export const requestBoard = (room: string) => sendWhiteboard({ t: "wb_open", room });

export function drawStroke(room: string, stroke: Stroke) {
  upsert(room, stroke);
  sendWhiteboard({ t: "wb_stroke", room, stroke });
}

export const clearBoard = (room: string) => sendWhiteboard({ t: "wb_clear", room });

/** Gambar coretan ke canvas 2D (dipakai modal whiteboard & tekstur 3D di dinding). */
export function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[], w: number, h: number) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    if (s.pts.length < 2) continue;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = (s.width * w) / 1600;
    ctx.beginPath();
    ctx.moveTo(s.pts[0] * w, s.pts[1] * h);
    for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i] * w, s.pts[i + 1] * h);
    if (s.pts.length === 2) ctx.lineTo(s.pts[0] * w + 0.1, s.pts[1] * h);
    ctx.stroke();
  }
}
