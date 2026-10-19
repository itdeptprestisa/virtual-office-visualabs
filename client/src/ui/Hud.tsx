import { useEffect, useState } from "react";
import { useGraphics } from "../graphics";
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
import { roomOf, zoneIn } from "../../../shared/layout";
import { switchView, teleportTo, toggleSit } from "../actions";
import { useWhiteboard } from "../whiteboard";
import { openGame } from "../games";
import { STATUS, StatusDot } from "./MemberPanel";
import { place, t, useT } from "../i18n";
import {
  ArrowsClockwiseIcon,
  CalendarBlankIcon,
  ChairIcon,
  ChalkboardSimpleIcon,
  ChatCircleDotsIcon,
  CirclesFourIcon,
  CubeIcon,
  DoorIcon,
  ElevatorIcon,
  FootprintsIcon,
  GearSixIcon,
  GlobeIcon,
  HandPalmIcon,
  JoystickIcon,
  KeyboardIcon,
  LockSimpleIcon,
  LockSimpleOpenIcon,
  MapPinIcon,
  MapTrifoldIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  MicrophoneStageIcon,
  MonitorArrowUpIcon,
  RecordIcon,
  RulerIcon,
  SpeakerSimpleHighIcon,
  TShirtIcon,
  UsersIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  WrenchIcon,
} from "./icons";
import { NoticeIcon, QuestionIcon } from "./icons";

export const totalUnread = (u: Partial<Record<string, number>>) => Object.values(u).reduce((a: number, b) => a + (b ?? 0), 0);

const DOOR_LABEL = { open: "Buka", close: "Tutup", knock: "Ketuk", lock: "Kunci", unlock: "Buka kunci" } as const;
// Penjelasan (tooltip) aksi pintu.
const doorTip = (action: keyof typeof DOOR_LABEL) =>
  ({
    open: t("Buka pintu (F)"),
    close: t("Tutup pintu (F)"),
    knock: t("Ketuk pintu (F) — orang di dalam mendapat pemberitahuan"),
    lock: t("Kunci pintu — orang di luar hanya bisa mengetuk"),
    unlock: t("Buka kunci pintu — orang di luar bisa masuk lagi"),
  })[action];
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
  // Layar presentasi di zona ini (ruangan/panggung) — untuk tombol Layar.
  const floorData = layout?.floors.find((f) => f.id === floor);
  const screenHere = zone && zone.kind !== "desk" ? floorData?.items.find((i) => i.type === "screen" && zoneIn(derived, i.x, i.z, true)?.id === zone.id) : undefined;
  const stageRoom = onStage ? roomOf(derived, zone) : null;

  return (
    <div className="desk-controls">
      {following && (
        <button className="pill clickable accent" onClick={() => useNet.setState({ following: null })} title={t("Berhenti mengikuti dan kendalikan avatarmu sendiri")}>
          <FootprintsIcon /> {t("Mengikuti {name} — berhenti", { name: following })}
        </button>
      )}
      {onStage && (
        <span className="pill stage">
          <MicrophoneStageIcon /> {stageRoom ? t("Kamu di panggung — semua orang di {room} mendengarmu", { room: place(stageRoom.name) }) : t("Kamu di panggung — semua orang di lantai ini mendengarmu")}
        </span>
      )}
      {nearLift && layout && (
        <div className="lift">
          <span className="pill">
            <ElevatorIcon /> Lift
          </span>
          {layout.floors.map((f) => (
            <button
              key={f.id}
              className={f.id === floor ? "pill active-floor" : "pill clickable"}
              disabled={f.id === floor}
              title={f.id === floor ? t("Kamu di lantai ini") : t("Naik lift ke {floor}", { floor: place(f.name) })}
              onClick={() => {
                const lift = f.items.find((i) => i.type === "elevator");
                const exit = lift ? derivedLiftExit(lift) : ([0, 8] as [number, number]);
                changeFloor(f.id, [exit[0], 0, exit[1]]);
                teleportTo(exit[0], exit[1]);
              }}
            >
              {place(f.name)}
            </button>
          ))}
        </div>
      )}
      {nearGame && !door && (
        <button className="pill clickable accent" onClick={() => openGame(nearGame)} title={t("Buka permainan (F)")}>
          {nearGame.type === "arcade" ? <JoystickIcon /> : <CirclesFourIcon />} <b>F</b> · {nearGame.type === "arcade" ? t("Main Snake") : t("Main Empat Sejajar")}
        </button>
      )}
      {(nearSeat || sitting) && (
        <button className="pill clickable accent" onClick={toggleSit} title={sitting ? t("Berdiri dari kursi (C)") : t("Duduk di kursi terdekat (C)")}>
          <ChairIcon /> <b>C</b> · {sitting ? t("Berdiri") : t("Duduk")}
        </button>
      )}
      {here && !hereState && !isGuest && (
        <button className="pill clickable accent" onClick={() => sendDesk("claim", here.id)} title={t("Jadikan meja ini milikmu — tersimpan, namamu tampil di meja")}>
          <ChairIcon /> {t("Jadikan {desk} mejaku", { desk: place(here.name) })}
        </button>
      )}
      {here && hereState && hereState.ownerId !== selfId && (
        <span className="pill">
          {hereState.locked ? <LockSimpleIcon /> : <ChairIcon />} {t("{desk} milik {name}", { desk: place(here.name), name: hereState.ownerName })}
        </span>
      )}
      {mine && (
        <>
          <button
            className={mine[1].locked ? "pill clickable danger" : "pill clickable"}
            onClick={() => sendDesk(mine[1].locked ? "unlock" : "lock")}
            title={mine[1].locked ? t("Matikan mode fokus — orang lain bisa masuk ke mejamu lagi") : t("Mode fokus: tidak ada yang bisa masuk ke mejamu dan statusmu jadi Fokus")}
          >
            {mine[1].locked ? (
              <>
                <LockSimpleIcon /> {t("Fokus aktif di {desk} — buka kunci", { desk: place(mineName) })}
              </>
            ) : (
              <>
                <LockSimpleOpenIcon /> {t("Kunci {desk} (mode fokus)", { desk: place(mineName) })}
              </>
            )}
          </button>
          {here?.id === mine[0] && (
            <button className="pill clickable" onClick={() => sendDesk("release")} title={t("Lepaskan meja ini supaya bisa dipakai orang lain")}>
              {t("Lepas meja")}
            </button>
          )}
        </>
      )}
      {door &&
        (() => {
          const action = doorPrimaryAction(door.id, roomDoor?.id === door.id);
          return (
            <button className="pill clickable accent" onClick={() => sendDoor(door.id, action)} title={doorTip(action)}>
              <DoorIcon /> <b>F</b> · {doorText(action, door.name)}
              {action === "knock" && ` ${t("(terkunci)")}`}
            </button>
          );
        })()}
      {roomDoor && (
        <button
          className={doorState(roomDoor.id).locked ? "pill clickable danger" : "pill clickable"}
          onClick={() => sendDoor(roomDoor.id, doorState(roomDoor.id).locked ? "unlock" : "lock")}
          title={doorTip(doorState(roomDoor.id).locked ? "unlock" : "lock")}
        >
          {doorState(roomDoor.id).locked ? (
            <>
              <LockSimpleIcon /> {t("Pintu terkunci — buka kunci")}
            </>
          ) : (
            <>
              <LockSimpleOpenIcon /> {t("Kunci pintu ruangan")}
            </>
          )}
        </button>
      )}
      {(inRoom || onStage) && zone && (
        <div className="meeting-tools">
          <button
            className={myHand ? "pill clickable accent" : "pill clickable"}
            onClick={() => sendHand(!myHand)}
            title={t("Tanda ingin bicara — tampil di atas namamu & di daftar anggota")}
          >
            <HandPalmIcon /> {myHand ? t("Turunkan tangan") : t("Angkat tangan")}
          </button>
          <button
            className="pill clickable"
            title={t("Matikan mic semua orang di sini — mereka bisa menyalakannya lagi")}
            onClick={() => {
              sendMuteRoom();
              showNotice(t("Mic semua orang di {place} dimatikan", { place: place(zone.name) }), "mute");
            }}
          >
            <MicrophoneSlashIcon /> {t("Mute semua")}
          </button>
          {inRoom && (
            <button className="pill clickable" onClick={() => useWhiteboard.setState({ open: zone.refId })} title={t("Papan tulis bersama — hanya orang di ruangan ini yang bisa melihat & menggambar")}>
              <ChalkboardSimpleIcon /> Whiteboard
            </button>
          )}
          {inRoom && !isGuest && (
            <button className="pill clickable" onClick={() => useNet.setState({ openBooking: zone.refId })} title={t("Lihat & buat booking ruangan ini")}>
              <CalendarBlankIcon /> {t("Jadwal")}
            </button>
          )}
        </div>
      )}
      {screenHere && (
        <button className="pill clickable" onClick={() => useNet.setState({ openScreen: screenHere.id })} title={t("Tampilkan website di layar presentasi untuk semua orang di sini")}>
          <GlobeIcon /> {t("Layar")}
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
      <button className={mic ? "media-btn on" : "media-btn"} onClick={toggleMic} title={mic ? t("Matikan mikrofon (M)") : t("Nyalakan mikrofon (M)")}>
        {mic ? <MicrophoneIcon /> : <MicrophoneSlashIcon />}
      </button>
      <button className={cam ? "media-btn on" : "media-btn"} onClick={toggleCam} title={cam ? t("Matikan kamera (V)") : t("Nyalakan kamera (V)")}>
        {cam ? <VideoCameraIcon /> : <VideoCameraSlashIcon />}
      </button>
      <button
        className={sharing ? "media-btn on sharing" : "media-btn"}
        onClick={toggleScreen}
        disabled={!zone && !sharing}
        title={zone ? (sharing ? t("Berhenti share screen") : t("Share screen ke orang di area ini")) : t("Masuk ke sebuah area untuk share screen")}
      >
        <MonitorArrowUpIcon />
      </button>
      {ptt && mic && (
        <span className={talking ? "pill ptt on" : "pill ptt"}>
          {talking ? (
            <>
              <RecordIcon weight="fill" /> {t("Bicara…")}
            </>
          ) : (
            <>
              <KeyboardIcon /> {t("Tahan Spasi")}
            </>
          )}
        </span>
      )}
      <span className="pill media-info">
        {zone ? (
          nearby ? (
            <>
              <UsersIcon /> {t("{n} orang terhubung di area ini", { n: nearby })}
            </>
          ) : (
            t("Belum ada orang lain di area ini")
          )
        ) : (
          <>
            <RulerIcon /> {t("Radius {m} m", { m: PROXIMITY.hear })} · {nearby ? t("{n} orang di dekatmu", { n: nearby }) : t("tidak ada yang di dekatmu")}
          </>
        )}
      </span>
      {!canPlayAudio && (
        <button className="pill warn" onClick={enableAudio} title={t("Browser menahan suara sampai kamu klik sekali di halaman")}>
          <SpeakerSimpleHighIcon /> {t("Klik untuk aktifkan suara")}
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
  const view = useGraphics((s) => s.view);
  const fps = useGraphics((s) => s.fps);
  return (
    <div className="hud-top">
      <span className="pill">
        <span className="dot-online" /> {count} online
      </span>
      {me && (
        <span className="pill">
          <StatusDot status={me.status} /> {t(STATUS[me.status].label)}
        </span>
      )}
      {zone && (
        <span className="pill">
          <MapPinIcon /> {place(zone)}
        </span>
      )}
      <button
        className="pill clickable"
        onClick={() => switchView(view === "2d" ? "3d" : "2d")}
        title={t("Ganti ke tampilan {view} — posisi, chat & panggilan tetap", { view: view === "2d" ? "3D" : "2D" })}
      >
        {view === "2d" ? <MapTrifoldIcon /> : <CubeIcon />} {t("Tampilan")}: {view === "2d" ? "2D" : "3D"}
      </button>
      {view === "3d" && (
        <span className={fps && fps < 40 ? "pill warn" : "pill"} title={t("Frame per detik — di bawah 40 berarti berat")}>
          {fps} FPS
        </span>
      )}
      {phase === "reconnecting" && (
        <span className="pill warn">
          <ArrowsClockwiseIcon /> {t("Koneksi terputus — menyambung ulang…")}
        </span>
      )}
    </div>
  );
}

export type Panel = "members" | "admin" | "settings" | "avatar" | "help" | null;

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
          <ChatCircleDotsIcon />
          {unread > 0 && <span className="badge">{unread}</span>}
        </button>
      )}
      <button className={panel === "members" ? "tool active" : "tool"} onClick={() => toggle("members")} title={t("Anggota")}>
        <UsersIcon />
        <span className="tool-n">{online}</span>
      </button>
      <button className={panel === "avatar" ? "tool active" : "tool"} onClick={() => toggle("avatar")} title={t("Ubah avatar")}>
        <TShirtIcon />
      </button>
      <button className={panel === "settings" ? "tool active" : "tool"} onClick={() => toggle("settings")} title={t("Setelan")}>
        <GearSixIcon />
      </button>
      <button className={panel === "help" ? "tool help active" : "tool help"} onClick={() => toggle("help")} title={t("Petunjuk penggunaan")}>
        <QuestionIcon />
      </button>
      {isAdmin && (
        <button className={panel === "admin" ? "tool active" : "tool"} onClick={() => toggle("admin")} title="Admin">
          <WrenchIcon />
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
  return visible && notice ? (
    <div className="notice">
      {notice.icon && <NoticeIcon name={notice.icon} />} {notice.text}
    </div>
  ) : null;
}
