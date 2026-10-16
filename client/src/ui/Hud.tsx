import { useEffect, useState } from "react";
import { useGraphics } from "../Scene";
import {
  changeFloor,
  doorPrimaryAction,
  openChatTab,
  sendDesk,
  sendDoor,
  sendHand,
  sendMuteRoom,
  showNotice,
  useNet,
} from "../net";
import { enableAudio, toggleCam, toggleMic, toggleScreen, useMedia, usePrefs } from "../media";
import { PROXIMITY } from "../zones";
import { toggleSit } from "../Player";
import { useWhiteboard } from "../whiteboard";
import { openGame } from "../games";
import { STATUS, StatusDot } from "./MemberPanel";
import { place, t, useT } from "../i18n";

export const totalUnread = (u: Partial<Record<string, number>>) => Object.values(u).reduce((a: number, b) => a + (b ?? 0), 0);

const DOOR_LABEL = { open: "Buka", close: "Tutup", knock: "Ketuk", lock: "Kunci", unlock: "Buka kunci" } as const;
// Label pintu: aksi + nama pintu, mis. "Buka pintu ruang meeting" / "Open Ruang Meeting door".
const doorText = (action: keyof typeof DOOR_LABEL, name: string) => t("{action} {door}", { action: t(DOOR_LABEL[action]), door: place(name).toLowerCase() });

/** Tombol aksi sesuai konteks: meja, pintu, kursi, dan alat rapat di dalam ruangan. */
export function ContextActions() {
  const t = useT();
  const zoneId = useNet((s) => s.zoneId);
  const derived = useNet((s) => s.derived);
  const desks = useNet((s) => s.desks);
  const selfId = useNet((s) => s.selfId);
  const nearDoor = useNet((s) => s.nearDoor);
  const nearSeat = useNet((s) => s.nearSeat);
  const sitting = useNet((s) => s.sitting);
  const doors = useNet((s) => s.doors);
  const myHand = useNet((s) => s.directory.find((u) => u.id === s.selfId)?.hand ?? false);
  const nearLift = useNet((s) => s.nearLift);
  const nearGame = useNet((s) => s.nearGame);
  const layout = useNet((s) => s.layout);
  const floor = useNet((s) => s.floor);
  const isGuest = useNet((s) => s.me?.role === "guest");
  const following = useNet((s) => (s.following ? s.players[s.following]?.name : null));
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
  const onStage = !!zone?.stage;
  // Layar presentasi di zona ini (ruangan/panggung) — untuk tombol 🌐 Layar.
  const floorData = layout?.floors.find((f) => f.id === floor);
  const screenHere = zone && zone.kind !== "desk" ? floorData?.items.find((i) => i.type === "screen" && derived.zones.find((z) => z.id === zone.id && z.shape === "rect" && i.x >= z.x[0] && i.x <= z.x[1] && i.z >= z.z[0] && i.z <= z.z[1])) : undefined;

  return (
    <div className="desk-controls">
      {following && (
        <button className="pill clickable accent" onClick={() => useNet.setState({ following: null })}>
          👣 {t("Mengikuti {name} — berhenti", { name: following })}
        </button>
      )}
      {onStage && <span className="pill stage">🎤 {t("Kamu di panggung — semua orang di lantai ini mendengarmu")}</span>}
      {nearLift && layout && (
        <div className="lift">
          <span className="pill">🛗 Lift</span>
          {layout.floors.map((f) => (
            <button
              key={f.id}
              className={f.id === floor ? "pill active-floor" : "pill clickable"}
              disabled={f.id === floor}
              onClick={() => {
                const lift = f.items.find((i) => i.type === "elevator");
                const exit = lift ? derivedLiftExit(lift) : ([0, 8] as [number, number]);
                changeFloor(f.id, [exit[0], 0, exit[1]]);
                import("../Player").then((m) => m.teleportTo(exit[0], exit[1]));
              }}
            >
              {place(f.name)}
            </button>
          ))}
        </div>
      )}
      {nearGame && !door && (
        <button className="pill clickable accent" onClick={() => openGame(nearGame)}>
          {nearGame.type === "arcade" ? "🕹️" : "🔴"} <b>F</b> · {nearGame.type === "arcade" ? t("Main Snake") : t("Main Empat Sejajar")}
        </button>
      )}
      {(nearSeat || sitting) && (
        <button className="pill clickable accent" onClick={toggleSit}>
          🪑 <b>C</b> · {sitting ? t("Berdiri") : t("Duduk")}
        </button>
      )}
      {here && !hereState && !isGuest && (
        <button className="pill clickable accent" onClick={() => sendDesk("claim", here.id)}>
          🪑 {t("Jadikan {desk} mejaku", { desk: place(here.name) })}
        </button>
      )}
      {here && hereState && hereState.ownerId !== selfId && (
        <span className="pill">
          {hereState.locked ? "🔒" : "🪑"} {t("{desk} milik {name}", { desk: place(here.name), name: hereState.ownerName })}
        </span>
      )}
      {mine && (
        <>
          <button className={mine[1].locked ? "pill clickable danger" : "pill clickable"} onClick={() => sendDesk(mine[1].locked ? "unlock" : "lock")}>
            {mine[1].locked
              ? `🔒 ${t("Fokus aktif di {desk} — buka kunci", { desk: place(mineName) })}`
              : `🔓 ${t("Kunci {desk} (mode fokus)", { desk: place(mineName) })}`}
          </button>
          {here?.id === mine[0] && (
            <button className="pill clickable" onClick={() => sendDesk("release")}>
              {t("Lepas meja")}
            </button>
          )}
        </>
      )}
      {door &&
        (() => {
          const action = doorPrimaryAction(door.id, roomDoor?.id === door.id);
          return (
            <button className="pill clickable accent" onClick={() => sendDoor(door.id, action)}>
              🚪 <b>F</b> · {doorText(action, door.name)}
              {action === "knock" && ` ${t("(terkunci)")}`}
            </button>
          );
        })()}
      {roomDoor && (
        <button
          className={doorState(roomDoor.id).locked ? "pill clickable danger" : "pill clickable"}
          onClick={() => sendDoor(roomDoor.id, doorState(roomDoor.id).locked ? "unlock" : "lock")}
        >
          {doorState(roomDoor.id).locked ? `🔒 ${t("Pintu terkunci — buka kunci")}` : `🔓 ${t("Kunci pintu ruangan")}`}
        </button>
      )}
      {(inRoom || onStage) && zone && (
        <div className="meeting-tools">
          <button className={myHand ? "pill clickable accent" : "pill clickable"} onClick={() => sendHand(!myHand)}>
            ✋ {myHand ? t("Turunkan tangan") : t("Angkat tangan")}
          </button>
          <button
            className="pill clickable"
            onClick={() => {
              sendMuteRoom();
              showNotice(`🔇 ${t("Mic semua orang di {place} dimatikan", { place: place(zone.name) })}`);
            }}
          >
            🔇 {t("Mute semua")}
          </button>
          {inRoom && (
            <button className="pill clickable" onClick={() => useWhiteboard.setState({ open: zone.refId })}>
              📝 Whiteboard
            </button>
          )}
          {inRoom && !isGuest && (
            <button className="pill clickable" onClick={() => useNet.setState({ openBooking: zone.refId })}>
              📅 {t("Jadwal")}
            </button>
          )}
        </div>
      )}
      {screenHere && (
        <button className="pill clickable" onClick={() => useNet.setState({ openScreen: screenHere.id })}>
          🌐 {t("Layar")}
        </button>
      )}
    </div>
  );
}

/** Titik keluar lift (di depan pintunya) dari data item. */
function derivedLiftExit(lift: { x: number; z: number; rot: 0 | 1 | 2 | 3 }): [number, number] {
  const t = (lift.rot * Math.PI) / 2;
  return [lift.x + Math.round(Math.sin(t)) * 1.2, lift.z + Math.round(Math.cos(t)) * 1.2];
}

export function MediaBar() {
  const t = useT();
  const { status, mic, cam, canPlayAudio, nearby, sharing, talking } = useMedia();
  const ptt = usePrefs((s) => s.ptt);
  const zone = useNet((s) => s.zone);
  if (status === "off") return null;
  if (status === "connecting")
    return (
      <div className="media-bar">
        <span className="pill">{t("Menghubungkan audio/video…")}</span>
      </div>
    );
  if (status === "error")
    return (
      <div className="media-bar">
        <span className="pill warn">{t("Audio/video tidak tersedia")}</span>
      </div>
    );
  return (
    <div className="media-bar">
      <button className={mic ? "media-btn on" : "media-btn"} onClick={toggleMic} title={`${t("Mikrofon")} (M)`}>
        {mic ? "🎤" : "🔇"}
      </button>
      <button className={cam ? "media-btn on" : "media-btn"} onClick={toggleCam} title={`${t("Kamera")} (V)`}>
        {cam ? "📷" : "🚫"}
      </button>
      <button
        className={sharing ? "media-btn on sharing" : "media-btn"}
        onClick={toggleScreen}
        disabled={!zone && !sharing}
        title={zone ? (sharing ? t("Berhenti share screen") : t("Share screen ke orang di area ini")) : t("Masuk ke sebuah area untuk share screen")}
      >
        🖥️
      </button>
      {ptt && mic && <span className={talking ? "pill ptt on" : "pill ptt"}>{talking ? `🔴 ${t("Bicara…")}` : `⌨️ ${t("Tahan Spasi")}`}</span>}
      <span className="pill media-info">
        {zone
          ? nearby
            ? `👥 ${t("{n} orang terhubung di area ini", { n: nearby })}`
            : t("Belum ada orang lain di area ini")
          : `📏 ${t("Radius {m} m", { m: PROXIMITY.hear })} · ${nearby ? t("{n} orang di dekatmu", { n: nearby }) : t("tidak ada yang di dekatmu")}`}
      </span>
      {!canPlayAudio && (
        <button className="pill warn" onClick={enableAudio}>
          🔈 {t("Klik untuk aktifkan suara")}
        </button>
      )}
    </div>
  );
}

export function TopLeft() {
  const t = useT();
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
          <StatusDot status={me.status} /> {t(STATUS[me.status].label)}
        </span>
      )}
      {zone && <span className="pill">📍 {place(zone)}</span>}
      <button className="pill clickable" onClick={() => setQuality(quality === "high" ? "low" : "high")}>
        {t("Grafik")}: {quality === "high" ? t("Tinggi") : t("Ringan")}
      </button>
      <span className={fps && fps < 40 ? "pill warn" : "pill"} title={t("Frame per detik — di bawah 40 berarti berat")}>
        {fps} FPS
      </span>
      {phase === "reconnecting" && <span className="pill warn">🔄 {t("Koneksi terputus — menyambung ulang…")}</span>}
    </div>
  );
}

export type Panel = "members" | "admin" | "settings" | "avatar" | null;

export function Toolbar({ panel, setPanel, compact }: { panel: Panel; setPanel: (p: Panel) => void; compact: boolean }) {
  const t = useT();
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
      <button className={panel === "members" ? "tool active" : "tool"} onClick={() => toggle("members")} title={t("Anggota")}>
        👥<span className="tool-n">{online}</span>
      </button>
      <button className={panel === "avatar" ? "tool active" : "tool"} onClick={() => toggle("avatar")} title={t("Ubah avatar")}>
        👕
      </button>
      <button className={panel === "settings" ? "tool active" : "tool"} onClick={() => toggle("settings")} title={t("Setelan")}>
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
  const t = useT();
  return (
    <details className="hud-help">
      <summary>⌨️ {t("Kontrol")}</summary>
      <ul>
        <li>
          <b>WASD</b> {t("jalan")} · <b>Shift</b> {t("lari")}
        </li>
        <li>
          <b>Drag / Q·E</b> {t("putar kamera")} · <b>Scroll</b> zoom
        </li>
        <li>
          <b>C</b> {t("duduk")} · <b>F</b> {t("pintu")} · <b>Space</b> push-to-talk
        </li>
        <li>
          <b>1</b> {t("lambai")} · <b>2</b> {t("jempol")} · <b>3</b> {t("joget")}
        </li>
        <li>
          <b>M</b> mic · <b>V</b> {t("kamera")} · <b>Enter</b> chat
        </li>
      </ul>
    </details>
  );
}
