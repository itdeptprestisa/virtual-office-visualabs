import { useEffect, useState } from "react";
import { Scene } from "./Scene";
import { boot, sendAvatar, sendStatus, useNet } from "./net";
import { AvatarEditor } from "./avatar/AvatarEditor";
import { connectMedia, room, setupPushToTalk, toggleCam, toggleMic, useMedia } from "./media";
import { ScreenModal, ScreenPanel } from "./ScreenShare";
import { WhiteboardModal } from "./WhiteboardView";
import { requestBoard } from "./whiteboard";
import { AuthScreen, FirstAvatarScreen, GuestScreen, KickedScreen } from "./ui/AuthScreen";
import { BookingModal } from "./ui/BookingModal";
import { TempPasswordModal } from "./ui/AdminPanel";
import { ChatPanel } from "./ui/ChatPanel";
import { MemberPanel, SummonPrompt } from "./ui/MemberPanel";
import { SettingsModal } from "./ui/SettingsModal";
import { AdminPanel } from "./ui/AdminPanel";
import { EditorPanel } from "./ui/EditorPanel";
import { Joystick } from "./ui/Joystick";
import { t, useT } from "./i18n";
import { ContextActions, HelpPanel, MediaBar, Notice, Toolbar, TopLeft, totalUnread, type Panel } from "./ui/Hud";

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
    if (media) connectMedia(media.url ?? `ws://${location.hostname}:7880`, media.token);
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
  const [panel, setPanel] = useState<Panel>(null);
  const [compact, setCompact] = useState(() => matchMedia(COMPACT).matches);
  useIdleStatus();
  useTitleBadge();
  useRoomBoard();

  useEffect(() => {
    const mq = matchMedia(COMPACT);
    const on = () => setCompact(mq.matches);
    mq.addEventListener("change", on);
    if (mq.matches) useNet.setState({ chatOpen: false }); // di HP chat disembunyikan dulu, dibuka lewat 💬
    return () => mq.removeEventListener("change", on);
  }, []);

  return (
    <div className={compact ? "office compact" : "office"}>
      <Scene />
      <TopLeft />
      <ContextActions />
      <Toolbar panel={panel} setPanel={setPanel} compact={compact} />
      <ScreenPanel />
      <Notice />
      <SummonPrompt />
      <MediaBar />
      <ChatPanel />
      {compact ? <Joystick /> : <HelpPanel />}
      <EditorPanel />
      <WhiteboardModal />
      <BookingModal />
      <ScreenModal />
      <TempPasswordModal />
      {panel === "members" && <MemberPanel onClose={() => setPanel(null)} />}
      {panel === "admin" && <AdminPanel onClose={() => setPanel(null)} />}
      {panel === "settings" && <SettingsModal onClose={() => setPanel(null)} />}
      {panel === "avatar" && <AvatarModal onClose={() => setPanel(null)} />}
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
