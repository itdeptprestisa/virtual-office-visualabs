// Material layar presentasi untuk mode 3D (tekstur video / kartu website).
import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, SRGBColorSpace, VideoTexture } from "three";
import { useNet } from "./net";
import { useScreenTrack, websiteCanvas } from "./screenTrack";

/**
 * Layar presentasi di sebuah zona (ruangan / panggung). Prioritas: share screen dari orang yang sedang berada di
 * zona itu → website yang dipasang di layar → gelap. Track orang lain hanya kita terima bila memang tersambung
 * dengannya (satu area, atau dia di panggung), jadi orang di luar ruangan tetap melihat layar gelap.
 */
export function PresentationMaterial({ zone, itemId }: { zone: string | null; itemId: string }) {
  const url = useNet((s) => s.screens[itemId]);
  const track = useScreenTrack(zone);

  const [videoTex, setVideoTex] = useState<VideoTexture | null>(null);
  useEffect(() => {
    if (!track) {
      setVideoTex(null);
      return;
    }
    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    track.attach(el);
    el.play().catch(() => {});
    const t = new VideoTexture(el);
    t.colorSpace = SRGBColorSpace;
    setVideoTex(t);
    return () => {
      track.detach(el);
      t.dispose();
    };
  }, [track]);

  const webTex = useMemo(() => {
    if (!url) return null;
    const tex = new CanvasTexture(websiteCanvas(url));
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, [url]);
  useEffect(() => () => webTex?.dispose(), [webTex]);

  const map = videoTex ?? webTex;
  return map ? (
    <meshBasicMaterial map={map} toneMapped={false} />
  ) : (
    <meshStandardMaterial color="#20232e" emissive="#3a5a8c" emissiveIntensity={0.4} />
  );
}
