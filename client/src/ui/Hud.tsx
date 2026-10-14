import { useEffect, useState } from "react";
import { useGraphics } from "../Scene";
import {
  doorPrimaryAction,
  openChatTab,
  sendDesk,
  sendDoor,
  sendHand,
  sendMuteRoom,
  showNotice,
  useNet,
} from "../net";
import { enableAudio, toggleCam, toggleMic, toggleScreen, useMedia } from "../media";
import { PROXIMITY } from "../zones";
import { toggleSit } from "../Player";
import { useWhiteboard } from "../whiteboard";
import { STATUS, StatusDot } from "./MemberPanel";

export const totalUnread = (u: Partial<Record<string, number>>) => Object.values(u).reduce((a: number, b) => a + (b ?? 0), 0);

const DOOR_LABEL = { open: "Buka", close: "Tutup", knock: "Ketuk", lock: "Kunci", unlock: "Buka kunci" } as const;

/** Tombol aksi sesuai konteks: meja, pintu, kursi, dan alat rapat di dalam ruangan. */
export function ContextActions() {
  const zoneId = useNet((s) => s.zoneId);
  const derived = useNet((s) => s.derived);
  const desks = useNet((s) => s.desks);
  const selfId = useNet((s) => s.selfId);
  const nearDoor = useNet((s) => s.nearDoor);
  const nearSeat = useNet((s) => s.nearSeat);
  const sitting = useNet((s) => s.sitting);
  const doors = useNet((s) => s.doors);
  const myHand = useNet((s) => s.directory.find((u) => u.id === s.selfId)?.hand ?? false);
  if (!derived) return null;

  const zone = derived.zones.find((z) => z.id === zoneId);
  const here = zone?.kind === "desk" ? zone : null;
  const hereState = here ? desks[here.id] : undefined;
  const mine = Object.entries(desks).find(([, d]) => d.ownerId === selfId);
  const mineName = mine ? derived.zones.find((z) => z.id === mine[0])?.name : null;
  const door = derived.doors.find((d) => d.id === nearDoor);
  const roomDoor = derived.doors.find((d) => d.room === zone?.id); // kunci bisa diatur dari mana pun di dalam ruangan
  const doorState = (id: string) => doors[id] ?? { open: true, locked: false };
  const inRoom = zone?.kind === "room";

  return (
    <div className="desk-controls">
      {(nearSeat || sitting) && (
        <button className="pill clickable accent" onClick={toggleSit}>
          🪑 <b>C</b> · {sitting ? "Berdiri" : "Duduk"}
        </button>
      )}
      {here && !hereState && (
        <button className="pill clickable accent" onClick={() => sendDesk("claim", here.id)}>
          🪑 Jadikan {here.name} mejaku
        </button>
      )}
      {here && hereState && hereState.ownerId !== selfId && (
        <span className="pill">
          {hereState.locked ? "🔒" : "🪑"} {here.name} milik {hereState.ownerName}
        </span>
      )}
      {mine && (
        <>
          <button className={mine[1].locked ? "pill clickable danger" : "pill clickable"} onClick={() => sendDesk(mine[1].locked ? "unlock" : "lock")}>
            {mine[1].locked ? `🔒 Fokus aktif di ${mineName} — buka kunci` : `🔓 Kunci ${mineName} (mode fokus)`}
          </button>
          {here?.id === mine[0] && (
            <button className="pill clickable" onClick={() => sendDesk("release")}>
              Lepas meja
            </button>
          )}
        </>
      )}
      {door &&
        (() => {
          const action = doorPrimaryAction(door.id, roomDoor?.id === door.id);
          return (
            <button className="pill clickable accent" onClick={() => sendDoor(door.id, action)}>
              🚪 <b>F</b> · {DOOR_LABEL[action]} {door.name.toLowerCase()}
              {action === "knock" && " (terkunci)"}
            </button>
          );
        })()}
      {roomDoor && (
        <button
          className={doorState(roomDoor.id).locked ? "pill clickable danger" : "pill clickable"}
          onClick={() => sendDoor(roomDoor.id, doorState(roomDoor.id).locked ? "unlock" : "lock")}
        >
          {doorState(roomDoor.id).locked ? "🔒 Pintu terkunci — buka kunci" : "🔓 Kunci pintu ruangan"}
        </button>
      )}
      {inRoom && zone && (
        <div className="meeting-tools">
          <button className={myHand ? "pill clickable accent" : "pill clickable"} onClick={() => sendHand(!myHand)}>
            {myHand ? "✋ Turunkan tangan" : "✋ Angkat tangan"}
          </button>
          <button
            className="pill clickable"
            onClick={() => {
              sendMuteRoom();
              showNotice(`🔇 Mic semua orang di ${zone.name} dimatikan`);
            }}
          >
            🔇 Mute semua
          </button>
          <button className="pill clickable" onClick={() => useWhiteboard.setState({ open: zone.refId })}>
            📝 Whiteboard
          </button>
        </div>
      )}
    </div>
  );
}

export function MediaBar() {
  const { status, mic, cam, canPlayAudio, nearby, sharing } = useMedia();
  const zone = useNet((s) => s.zone);
  if (status === "off") return null;
  if (status === "connecting")
    return (
      <div className="media-bar">
        <span className="pill">Menghubungkan audio/video…</span>
      </div>
    );
  if (status === "error")
    return (
      <div className="media-bar">
        <span className="pill warn">Audio/video tidak tersedia</span>
      </div>
    );
  return (
    <div className="media-bar">
      <button className={mic ? "media-btn on" : "media-btn"} onClick={toggleMic} title="Mikrofon (M)">
        {mic ? "🎤" : "🔇"}
      </button>
      <button className={cam ? "media-btn on" : "media-btn"} onClick={toggleCam} title="Kamera (V)">
        {cam ? "📷" : "🚫"}
      </button>
      <button
        className={sharing ? "media-btn on sharing" : "media-btn"}
        onClick={toggleScreen}
        disabled={!zone && !sharing}
        title={zone ? (sharing ? "Berhenti share screen" : "Share screen ke orang di area ini") : "Masuk ke sebuah area untuk share screen"}
      >
        🖥️
      </button>
      <span className="pill media-info">
        {zone
          ? nearby
            ? `👥 ${nearby} orang terhubung di area ini`
            : "Belum ada orang lain di area ini"
          : `📏 Radius ${PROXIMITY.hear} m · ${nearby ? `${nearby} orang di dekatmu` : "tidak ada yang di dekatmu"}`}
      </span>
      {!canPlayAudio && (
        <button className="pill warn" onClick={enableAudio}>
          🔈 Klik untuk aktifkan suara
        </button>
      )}
    </div>
  );
}

export function TopLeft() {
  const count = useNet((s) => s.directory.filter((u) => u.online).length);
  const zone = useNet((s) => s.zone);
  const me = useNet((s) => s.directory.find((u) => u.id === s.selfId));
  const phase = useNet((s) => s.phase);
  const quality = useGraphics((s) => s.quality);
  const setQuality = useGraphics((s) => s.setQuality);
  const fps = useGraphics((s) => s.fps);
  return (
    <div className="hud-top">
      <span className="pill">🟢 {count} online</span>
      {me && (
        <span className="pill">
          <StatusDot status={me.status} /> {STATUS[me.status].label}
        </span>
      )}
      {zone && <span className="pill">📍 {zone}</span>}
      <button className="pill clickable" onClick={() => setQuality(quality === "high" ? "low" : "high")}>
        Grafik: {quality === "high" ? "Tinggi" : "Ringan"}
      </button>
      <span className={fps && fps < 40 ? "pill warn" : "pill"} title="Frame per detik — di bawah 40 berarti berat">
        {fps} FPS
      </span>
      {phase === "reconnecting" && <span className="pill warn">🔄 Koneksi terputus — menyambung ulang…</span>}
    </div>
  );
}

export type Panel = "members" | "admin" | "settings" | "avatar" | null;

export function Toolbar({ panel, setPanel, compact }: { panel: Panel; setPanel: (p: Panel) => void; compact: boolean }) {
  const isAdmin = useNet((s) => s.me?.role === "admin");
  const online = useNet((s) => s.directory.filter((u) => u.online).length);
  const unread = useNet((s) => totalUnread(s.unread));
  const chatOpen = useNet((s) => s.chatOpen);
  const toggle = (p: Panel) => setPanel(panel === p ? null : p);
  return (
    <div className="toolbar">
      {compact && (
        <button className="tool" onClick={() => (chatOpen ? useNet.setState({ chatOpen: false }) : openChatTab(useNet.getState().chatTab))} title="Chat">
          💬{unread > 0 && <span className="badge">{unread}</span>}
        </button>
      )}
      <button className={panel === "members" ? "tool active" : "tool"} onClick={() => toggle("members")} title="Anggota">
        👥<span className="tool-n">{online}</span>
      </button>
      <button className={panel === "avatar" ? "tool active" : "tool"} onClick={() => toggle("avatar")} title="Ubah avatar">
        👕
      </button>
      <button className={panel === "settings" ? "tool active" : "tool"} onClick={() => toggle("settings")} title="Setelan">
        ⚙️
      </button>
      {isAdmin && (
        <button className={panel === "admin" ? "tool active" : "tool"} onClick={() => toggle("admin")} title="Admin">
          🛠️
        </button>
      )}
    </div>
  );
}

export function Notice() {
  const notice = useNet((s) => s.notice);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!notice) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  return visible && notice ? <div className="notice">{notice.text}</div> : null;
}

export function HelpPanel() {
  return (
    <details className="hud-help">
      <summary>⌨️ Kontrol</summary>
      <ul>
        <li>
          <b>WASD</b> jalan · <b>Shift</b> lari
        </li>
        <li>
          <b>Drag / Q·E</b> putar kamera · <b>Scroll</b> zoom
        </li>
        <li>
          <b>C</b> duduk · <b>F</b> pintu
        </li>
        <li>
          <b>1</b> lambai · <b>2</b> jempol · <b>3</b> joget
        </li>
        <li>
          <b>M</b> mic · <b>V</b> kamera · <b>Enter</b> chat
        </li>
      </ul>
    </details>
  );
}
