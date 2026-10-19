import { useEffect, useMemo, useRef, useState } from "react";
import { zoneIn, type Item } from "../../../shared/layout";
import { selfPos, useNet, type PlayerInfo } from "../net";
import { useMedia } from "../media";
import { useKeyboard } from "../useKeyboard";
import { pointerLock, touchInput } from "../input";
import { moveItem, snap, useEditor } from "../editor";
import { hitItem } from "./editor2d";
import { createController, seatMissing } from "../controller";
import { defaultIO } from "../controllerIO";
import { setActiveController, switchView } from "../actions";
import { buildObstacles, createMotion2D, Grid } from "../motion2d";
import { sampleRemote } from "../interp";
import { world as currentWorld } from "../zones";
import { ANIM } from "../anims";
import { AvatarLabel } from "../avatarLabel";
import { useScreenTrack, websiteCanvas } from "../screenTrack";
import { paint, useWhiteboard } from "../whiteboard";
import { bookingLabel } from "../bookingLabel";
import { useLang, useT } from "../i18n";
import { clampZoom, minZoom, pinchZoom, toScreen, toWorld2, type Cam } from "./camera";
import { StaticLayer } from "./staticLayer";
import { followCam } from "./layerPlan";
import { placeLabels } from "./labels";
import { drawDynamic, type Body2D } from "./dynamic";

const BOARD_W = 1024;
const BOARD_H = 552;

/** Sumber gambar layar presentasi (tak terlihat): share screen orang di zona itu → video; website → kartu. */
function ScreenFeed({ item, zone, sources }: { item: Item; zone: string | null; sources: Map<string, CanvasImageSource> }) {
  const track = useScreenTrack(zone);
  const url = useNet((s) => s.screens[item.id]);
  useEffect(() => {
    if (track) {
      const el = document.createElement("video");
      el.muted = true;
      el.playsInline = true;
      el.autoplay = true;
      track.attach(el);
      el.play().catch(() => {});
      sources.set(item.id, el);
      return () => {
        track.detach(el);
        sources.delete(item.id);
      };
    }
    if (url) {
      sources.set(item.id, websiteCanvas(url));
      return () => void sources.delete(item.id);
    }
  }, [track, url, item.id, sources]);
  return null;
}

/** Kanvas coretan whiteboard — hanya terisi untuk orang di dalam ruangan (sama dengan 3D). */
function BoardFeed({ item, room, boards }: { item: Item; room: string | null; boards: Map<string, HTMLCanvasElement> }) {
  const inside = useNet((s) => !!room && s.zoneId === `room:${room}`);
  const strokes = useWhiteboard((s) => (room ? s.boards[room] : undefined));
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = BOARD_W;
    c.height = BOARD_H;
    return c;
  }, []);
  useEffect(() => {
    if (!inside) {
      boards.delete(item.id);
      return;
    }
    paint(canvas.getContext("2d")!, strokes ?? [], BOARD_W, BOARD_H);
    boards.set(item.id, canvas);
  }, [inside, strokes, canvas, item.id, boards]);
  useEffect(() => () => void boards.delete(item.id), [item.id, boards]);
  return null;
}

/** Label booking per pintu, dihitung ulang saat jadwal berubah dan tiap 30 detik. */
function useBookingLabels() {
  const lang = useLang((s) => s.lang);
  const bookings = useNet((s) => s.bookings);
  const doors = useNet((s) => s.derived?.doors);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    const out: { room: string; text: string; now: boolean }[] = [];
    for (const d of doors ?? []) {
      const b = bookingLabel(d.id, bookings, now);
      if (b) out.push({ room: d.id, ...b });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, doors, now, lang]);
}

/** Mode tampilan 2D: kanvas + loop frame; logika permainan memakai controller yang sama dengan 3D. */
export function World2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelEls = useMemo(() => new Map<string, HTMLDivElement>(), []);
  const labelRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) labelEls.set(id, el);
    else labelEls.delete(id);
  };
  const t = useT(); // teks "Terkunci" & pesan ikut bahasa
  const [failed, setFailed] = useState(false);
  const self = useNet((s) => s.self)!;
  const players = useNet((s) => s.players);
  const floorId = useNet((s) => s.floor);
  const { held, pressed } = useKeyboard();

  // Penghalang dihitung ulang hanya saat denah / lantai / status pintu berubah.
  const gridRef = useRef<Grid | null>(null);
  const motion = useMemo(() => {
    const s = selfPos.p ?? useNet.getState().spawn;
    return createMotion2D(() => gridRef.current ?? new Grid([]), [s[0], s[2]]);
  }, []);
  const controller = useMemo(() => createController(motion, { held: held.current, pressed: pressed.current, touch: touchInput }, defaultIO), [motion, held, pressed]);
  // Saat dilepas (ganti mode tampilan): berdiri dulu supaya status duduk tidak tertinggal.
  useEffect(() => {
    const release = setActiveController(controller);
    return () => {
      if (controller.seat) controller.standUp();
      release();
    };
  }, [controller]);

  useEffect(() => {
    const rebuild = () => {
      const { layout, floor, derived, doors } = useNet.getState();
      const f = layout?.floors.find((x) => x.id === floor);
      gridRef.current = f && derived ? new Grid(buildObstacles(f, derived, doors)) : null;
    };
    rebuild();
    return useNet.subscribe((s, prev) => {
      if (s.layout !== prev.layout || s.floor !== prev.floor || s.derived !== prev.derived || s.doors !== prev.doors) rebuild();
    });
  }, []);

  // Kursi yang diduduki hilang (denah diubah) → berdiri.
  const derived = useNet((s) => s.derived);
  useEffect(() => {
    if (seatMissing(controller.seat, currentWorld().seats)) controller.standUp();
  }, [derived, controller]);

  // Data lapisan dinamis yang tidak berasal dari state per frame.
  const doorAnim = useRef(new Map<string, number>());
  const screens = useMemo(() => new Map<string, CanvasImageSource>(), []);
  const boards = useMemo(() => new Map<string, HTMLCanvasElement>(), []);
  const bookingList = useBookingLabels();
  const bookingRef = useRef(bookingList);
  bookingRef.current = bookingList;
  const lockedText = t("Terkunci");
  const lockedRef = useRef(lockedText);
  lockedRef.current = lockedText;

  const cam = useRef<Cam>({ x: motion.position()[0], z: motion.position()[2], zoom: 1, w: 1, h: 1 });
  const layer = useMemo(() => new StaticLayer(), []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext("2d");
    if (!g) {
      setFailed(true); // sangat jarang (browser/GPU menolak kanvas) → tawarkan mode 3D
      return;
    }
    let raf = 0;
    let last = performance.now();
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      cam.current.w = r.width;
      cam.current.h = r.height;
      canvas.width = Math.round(r.width * devicePixelRatio);
      canvas.height = Math.round(r.height * devicePixelRatio);
    };
    resize();
    const ro = new ResizeObserver(resize);
    // Pindah ke layar dengan kepadatan piksel lain (mis. monitor eksternal) → ukuran kanvas ikut.
    let dprQuery: MediaQueryList | null = null;
    const watchDpr = () => {
      dprQuery?.removeEventListener("change", onDpr);
      dprQuery = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
      dprQuery.addEventListener("change", onDpr);
    };
    const onDpr = () => {
      resize();
      watchDpr();
    };
    watchDpr();
    // Font belum siap saat lapisan diam pertama digambar → gambar ulang setelah siap.
    document.fonts?.ready.then(() => layer.invalidate());
    ro.observe(canvas);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.current.zoom = clampZoom(cam.current, cam.current.zoom * Math.exp(-e.deltaY * 0.0015));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // Editor denah (admin): klik furnitur = pilih, seret = geser (snap), lepas = simpan; klik lantai kosong = batal pilih.
    let dragging: number | null = null;
    const worldAt = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return toWorld2(cam.current, e.clientX - r.left, e.clientY - r.top);
    };
    // Cubit dua jari (layar sentuh) = zoom.
    const touches = new Map<number, [number, number]>();
    let pinch: { zoom: number; dist: number } | null = null;
    const touchDist = () => {
      const [a, b] = [...touches.values()];
      return Math.hypot(a[0] - b[0], a[1] - b[1]);
    };
    const onTouchDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (touches.size === 2) pinch = { zoom: cam.current.zoom, dist: touchDist() };
    };
    const onTouchMove = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && touches.size >= 2) cam.current.zoom = pinchZoom(pinch.zoom, pinch.dist, touchDist(), minZoom(cam.current));
    };
    const onTouchUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
    };
    canvas.addEventListener("pointerdown", onTouchDown);
    canvas.addEventListener("pointermove", onTouchMove);
    canvas.addEventListener("pointerup", onTouchUp);
    canvas.addEventListener("pointercancel", onTouchUp);

    const onDown = (e: PointerEvent) => {
      if (!useEditor.getState().active || touches.size > 1) return;
      const [wx, wz] = worldAt(e);
      const st = useNet.getState();
      const items = st.layout?.floors.find((x) => x.id === st.floor)?.items ?? [];
      const it = hitItem(items, wx, wz);
      if (!it) {
        useEditor.setState({ selected: null });
        return;
      }
      dragging = e.pointerId;
      pointerLock.editor = true;
      canvas.setPointerCapture(e.pointerId);
      useEditor.setState({ selected: it.id, drag: { id: it.id, x: it.x, z: it.z } });
    };
    const onMove = (e: PointerEvent) => {
      if (dragging !== e.pointerId || pinch) return;
      const d = useEditor.getState().drag;
      if (!d) return;
      const [wx, wz] = worldAt(e);
      useEditor.setState({ drag: { id: d.id, x: snap(wx), z: snap(wz) } });
    };
    const onUp = (e: PointerEvent) => {
      if (dragging !== e.pointerId) return;
      dragging = null;
      pointerLock.editor = false;
      const d = useEditor.getState().drag;
      useEditor.setState({ drag: null });
      const st = useNet.getState();
      const it = st.layout?.floors.find((x) => x.id === st.floor)?.items.find((i) => i.id === d?.id);
      if (d && it && (d.x !== it.x || d.z !== it.z)) moveItem(d.id, d.x, d.z);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    let handsCache: { dir: unknown; ids: Set<string> } = { dir: null, ids: new Set() };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      controller.step(dt, now / 1000, 0); // 2D: "maju" = utara (atas layar)
      motion.integrate(dt);
      const [px, , pz] = motion.position();
      const c = cam.current;
      followCam(c, px, pz, dt);

      const st = useNet.getState();
      const f = st.layout?.floors.find((x) => x.id === st.floor);
      if (!f || !st.derived) return;
      g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      g.clearRect(0, 0, c.w, c.h);
      const ed = useEditor.getState();
      layer.draw(g, c, { floor: f, derived: st.derived, skip: ed.drag?.id ?? null });
      if (handsCache.dir !== st.directory) handsCache = { dir: st.directory, ids: new Set(st.directory.filter((u) => u.hand).map((u) => u.id)) };
      const hands = handsCache.ids;
      const selfBody: Body2D = { id: self.id, cfg: st.self!.avatar, x: px, z: pz, facing: controller.facing, anim: controller.anim, hand: hands.has(self.id) };
      const others: Body2D[] = [];
      for (const pl of Object.values(st.players) as PlayerInfo[]) {
        if (pl.floor !== st.floor) continue;
        const s = sampleRemote(pl.id, now);
        if (s) others.push({ id: pl.id, cfg: pl.avatar, x: s.p[0], z: s.p[2], facing: s.r, anim: s.a, hand: hands.has(pl.id) });
      }
      const ka = 1 - Math.exp(-7 * dt);
      for (const d of st.derived.doors) {
        const target = st.doors[d.id]?.open === false ? 0 : 1;
        const cur = doorAnim.current.get(d.id) ?? target;
        doorAnim.current.set(d.id, cur + (target - cur) * ka);
      }
      const zone = st.zoneId ? (st.derived.zones.find((z) => z.id === st.zoneId) ?? null) : null;
      drawDynamic(g, c, {
        floor: f,
        derived: st.derived,
        zone,
        self: selfBody,
        others,
        ring: { show: !st.zone && !st.sitting, someone: useMedia.getState().nearby > 0 },
        t: now / 1000,
        doors: st.doors,
        doorAnim: doorAnim.current,
        desks: st.desks,
        bookings: bookingRef.current,
        screens,
        boards,
        lockedText: lockedRef.current,
        editor: { selected: ed.active ? ed.selected : null, drag: ed.drag },
      });
      // posisikan label HTML (pemain tanpa data posisi: labelnya disembunyikan)
      placeLabels(
        labelEls,
        [selfBody, ...others].map((b) => ({ id: b.id, x: b.x, z: b.z, sit: b.anim === ANIM.sit })),
        (x, z) => toScreen(c, x, z),
      );
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dprQuery?.removeEventListener("change", onDpr);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onTouchDown);
      canvas.removeEventListener("pointermove", onTouchMove);
      canvas.removeEventListener("pointerup", onTouchUp);
      canvas.removeEventListener("pointercancel", onTouchUp);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [controller, motion, layer, self.id, screens, boards, labelEls]);

  const onFloor = Object.values(players).filter((p) => p.floor === floorId);
  const items = useNet((s) => s.layout?.floors.find((f) => f.id === s.floor)?.items);
  const live = (items ?? []).filter((it) => it.type === "screen" || it.type === "whiteboard");
  return (
    <div className="world2d">
      {failed && (
        <div className="overlay">
          <div className="card">
            <p>{t("Tampilan 2D tidak bisa dibuat di browser ini.")}</p>
            <button className="primary" onClick={() => switchView("3d")}>
              {t("Pakai tampilan 3D")}
            </button>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} />
      {live.map((it) => {
        const zn = derived ? zoneIn(derived, it.x, it.z, true) : null;
        return it.type === "screen" ? (
          <ScreenFeed key={it.id} item={it} zone={zn?.id ?? null} sources={screens} />
        ) : (
          <BoardFeed key={it.id} item={it} room={zn?.kind === "room" ? zn.refId : null} boards={boards} />
        );
      })}
      <div className="overlay2d">
        <div ref={labelRef(self.id)} className="label2d">
          <AvatarLabel id={self.id} name={self.name} color={self.avatar.topColor} isSelf />
        </div>
        {onFloor.map((p) => (
          <div key={p.id} ref={labelRef(p.id)} className="label2d">
            <AvatarLabel id={p.id} name={p.name} color={p.avatar.topColor} />
          </div>
        ))}
      </div>
    </div>
  );
}
