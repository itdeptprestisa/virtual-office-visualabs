// Material whiteboard untuk mode 3D (tekstur kanvas).
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { paint, useWhiteboard } from "./whiteboard";
import { useNet } from "./net";
import { t } from "./i18n";

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
      ctx.font = `28px "Nunito Variable", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(t("Masuk ruangan untuk melihat whiteboard"), TEX_W / 2, TEX_H / 2);
    }
    texture.needsUpdate = true;
  }, [inside, strokes, canvas, texture]);

  useEffect(() => () => texture.dispose(), [texture]);
  return <meshBasicMaterial map={texture} toneMapped={false} />;
}
