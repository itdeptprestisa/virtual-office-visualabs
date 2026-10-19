import { Suspense, lazy, useEffect, useState } from "react";
import { World2D } from "./world2d/World2D";
import { useGraphics } from "./graphics";
import { boot, sendAvatar, sendStatus, showNotice, useNet } from "./net";
import { LazyBoundary } from "./LazyBoundary";
import { AvatarEditor } from "./avatar/AvatarEditor";
import { connectMedia, room, setupPushToTalk, toggleCam, toggleMic, useMedia } from "./media";
import { ScreenModal, ScreenPanel } from "./ScreenShare";
import { WhiteboardModal } from "./WhiteboardView";
import { requestBoard } from "./whiteboard";
import { AuthScreen, FirstAvatarScreen, GuestScreen, KickedScreen } from "./ui/AuthScreen";
import { BookingModal } from "./ui/BookingModal";
import { GameModal } from "./ui/GameModal";
import { TempPasswordModal } from "./ui/AdminPanel";
import { ChatPanel } from "./ui/ChatPanel";
import { MemberPanel, SummonPrompt } from "./ui/MemberPanel";
import { SettingsModal } from "./ui/SettingsModal";
import { AdminPanel } from "./ui/AdminPanel";
import { EditorPanel } from "./ui/EditorPanel";
import { Joystick } from "./ui/Joystick";
import { t, useT } from "./i18n";

// Mode 3D (Three.js + Rapier) baru diunduh saat dipilih — mode 2D tidak memuatnya.
const Scene = lazy(() => import("./Scene").then((m) => ({ default: m.Scene })));
/** Bagian 3D gagal diunduh (mis. versi lama setelah deploy ulang) → kembali ke 2D, bukan halaman putih. */
function fallbackTo2D() {
  useGraphics.getState().setView("2d");
  showNotice(t("Tampilan 3D gagal dimuat — kembali ke 2D. Muat ulang halaman untuk mencoba lagi."));
}
import { ContextActions, MediaBar, Notice, Toolbar, TopLeft, totalUnread, type Panel } from "./ui/Hud";
import { HelpModal, Tour, startTour } from "./ui/Guide";

// Ubah avatar di tengah permainan; perubahan langsung terlihat oleh semua orang.
function AvatarModal({ onClose }: { onClose: () => void }) {
  useT();
  const self = useNet((s) => s.self)!;
  const [avatar, setAvatar] = useState(self.avatar);
  return (
    <div className="overlay modal" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <AvatarEditor
        value={avatar}
        onChange={setAvatar}
        header={<h2 className="editor-header">{t("Ubah avatar")}</h2>}
        footer={
          <>
            <button type="button" className="secondary" onClick={onClose}>
              {t("Batal")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                sendAvatar(avatar);
                onClose();
              }}
            >
              {t("Simpan")}
            </button>
          </>
        }
      />
    </div>
  );
}

// Sambungkan LiveKit begitu server mengirim token; putus bila sesi berakhir. M/V untuk mic/kamera.
function useMediaConnection() {
  const media = useNet((s) => s.media);
  const phase = useNet((s) => s.phase);
  useEffect(() => {
    if (media) connectMedia(media.url ?? `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:7880`, media.token);
  }, [media]);
  useEffect(() => {
    if (phase === "kicked") room.disconnect();
  }, [phase]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || useMedia.getState().status !== "on") return;
      if (e.code === "KeyM") toggleMic();
      if (e.code === "KeyV") toggleCam();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

// Status "Away" otomatis bila tab ditinggal > 1 menit.
function useIdleStatus() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onVis = () => {
      if (timer) clearTimeout(timer);
      if (document.hidden) timer = setTimeout(() => sendStatus({ idle: true }), 60_000);
      else sendStatus({ idle: false });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
}

// Jumlah pesan belum dibaca di judul tab.
function useTitleBadge() {
  const unread = useNet((s) => totalUnread(s.unread));
  useEffect(() => {
    document.title = unread ? `(${unread}) Virtual Office` : "Virtual Office";
  }, [unread]);
}

// Masuk ke ruangan → ambil isi whiteboard ruangan itu (untuk tampilan di dinding).
function useRoomBoard() {
  const zoneId = useNet((s) => s.zoneId);
  useEffect(() => {
    if (zoneId?.startsWith("room:")) requestBoard(zoneId.slice(5));
  }, [zoneId]);
}

const COMPACT = "(max-width: 720px), (pointer: coarse)";

function Office() {
  const view = useGraphics((s) => s.view);
  const [panel, setPanel] = useState<Panel>(null);
  const [compact, setCompact] = useState(() => matchMedia(COMPACT).matches);
  useIdleStatus();
  useTitleBadge();
  useRoomBoard();
  // Akun baru: tur singkat sekali saat pertama masuk kantor (pengguna lama lewat tombol ? → Ulangi tur).
  useEffect(() => {
    if (useNet.getState().me?.tour) startTour();
  }, []);

  useEffect(() => {
    const mq = matchMedia(COMPACT);
    const on = () => setCompact(mq.matches);
    mq.addEventListener("change", on);
    if (mq.matches) useNet.setState({ chatOpen: false }); // di HP chat disembunyikan dulu, dibuka lewat tombol chat
    return () => mq.removeEventListener("change", on);
  }, []);

  return (
    <div className={compact ? "office compact" : "office"}>
      {view === "2d" ? (
        <World2D />
      ) : (
        <LazyBoundary onError={fallbackTo2D} fallback={null}>
          <Suspense fallback={<div className="overlay"><p className="muted">{t("Memuat tampilan 3D…")}</p></div>}>
            <Scene />
          </Suspense>
        </LazyBoundary>
      )}
      <TopLeft />
      <ContextActions />
      <Toolbar panel={panel} setPanel={setPanel} compact={compact} />
      <ScreenPanel />
      <Notice />
      <SummonPrompt />
      <MediaBar />
      <ChatPanel />
      {compact && <Joystick />}
      <EditorPanel />
      <WhiteboardModal />
      <BookingModal />
      <GameModal />
      <ScreenModal />
      <TempPasswordModal />
      {panel === "members" && <MemberPanel onClose={() => setPanel(null)} />}
      {panel === "admin" && <AdminPanel onClose={() => setPanel(null)} />}
      {panel === "settings" && <SettingsModal onClose={() => setPanel(null)} />}
      {panel === "avatar" && <AvatarModal onClose={() => setPanel(null)} />}
      {panel === "help" && <HelpModal onClose={() => setPanel(null)} />}
      <Tour />
    </div>
  );
}

export default function App() {
  useT(); // render ulang seluruh UI saat bahasa diganti
  const phase = useNet((s) => s.phase);
  const hasSelf = useNet((s) => s.self !== null);
  useMediaConnection();
  useEffect(boot, []);
  useEffect(setupPushToTalk, []);

  if (phase === "kicked") return <KickedScreen />;
  if (phase === "auth") return <AuthScreen />;
  if (phase === "guest") return <GuestScreen />;
  if (phase === "avatar") return <FirstAvatarScreen />;
  // Saat menyambung ulang, kantor tetap ditampilkan (posisi & kamera dipertahankan).
  if (!hasSelf)
    return (
      <div className="overlay">
        <p className="muted">{phase === "boot" ? t("Memuat…") : t("Masuk ke kantor…")}</p>
      </div>
    );
  return <Office />;
}
