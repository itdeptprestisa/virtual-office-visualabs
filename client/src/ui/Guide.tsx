import { useEffect, useState, type ReactNode } from "react";
import { create } from "zustand";
import { finishTour } from "../net";
import { useGraphics, type View } from "../graphics";
import { useT } from "../i18n";
import {
  ChairIcon,
  ChatCircleDotsIcon,
  DoorIcon,
  ElevatorIcon,
  FootprintsIcon,
  LightbulbIcon,
  MapTrifoldIcon,
  MicrophoneIcon,
  QuestionIcon,
  SmileyIcon,
} from "./icons";

// Petunjuk penggunaan: tur singkat (otomatis sekali untuk akun baru, bisa diulang) dan panel petunjuk lengkap.
// Bagian yang berbeda antara 2D & 3D (arah jalan, kamera, zoom) mengikuti tampilan yang aktif; di HP/tablet
// keyboard diganti joystick & gerakan sentuh.

export const useGuide = create<{ step: number | null }>(() => ({ step: null }));
export const startTour = () => useGuide.setState({ step: 0 });

type Line = { keys?: string[]; text: string; kb?: true }; // kb = hanya relevan dengan keyboard (disembunyikan di layar sentuh)
type Section = { icon: ReactNode; title: string; lines: Line[] };

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="keys">
      {keys.map((k) => (
        <kbd key={k}>{k}</kbd>
      ))}
    </span>
  );
}

/** Cara bergerak — satu-satunya bagian yang benar-benar beda antara 2D, 3D, keyboard & sentuh. */
function movement(t: ReturnType<typeof useT>, view: View, touch: boolean): Line[] {
  if (touch && view === "2d")
    return [
      { keys: [t("Joystick")], text: t("Jalan — dorong penuh untuk lari") },
      { keys: [t("Cubit")], text: t("Zoom; paling jauh menampilkan seluruh lantai") },
    ];
  if (touch)
    return [
      { keys: [t("Joystick")], text: t("Jalan — dorong penuh untuk lari") },
      { keys: [t("Geser layar")], text: t("Putar kamera") },
    ];
  if (view === "2d")
    return [
      { keys: ["W", "A", "S", "D"], text: t("Jalan (atau tombol panah) — W selalu ke atas layar") },
      { keys: ["Shift"], text: t("Lari") },
      { keys: ["Scroll"], text: t("Zoom; paling jauh menampilkan seluruh lantai") },
    ];
  return [
    { keys: ["W", "A", "S", "D"], text: t("Jalan (atau tombol panah), mengikuti arah kamera") },
    { keys: ["Shift"], text: t("Lari") },
    { keys: ["Drag", "Q", "E"], text: t("Putar kamera") },
    { keys: ["Scroll"], text: t("Zoom — dekat = sudut orang ketiga, jauh = dari atas") },
    { text: t("Kualitas grafis (High/Low/Flat) bisa diubah di Setelan bila terasa berat") },
  ];
}

/** Bagian yang sama di 2D & 3D. */
function sections(t: ReturnType<typeof useT>): Section[] {
  return [
    {
      icon: <MicrophoneIcon />,
      title: t("Suara & video"),
      lines: [
        { text: t("Di dalam area (ruangan, meja, lounge) semua orang di area itu saling mendengar dengan jelas; orang di luar tidak bisa ikut mendengar") },
        { text: t("Di luar area, suara terdengar dalam radius 4 m (lingkaran di lantai)") },
        { text: t("Yang berdiri di panggung town hall terdengar oleh seluruh ruangan") },
        { keys: ["M"], text: t("Mikrofon"), kb: true },
        { keys: ["V"], text: t("Kamera"), kb: true },
        { text: t("Share screen dari tombol di bawah — tampil di layar presentasi ruangan") },
        { keys: [t("Spasi")], text: t("Push-to-talk (nyalakan di Setelan)"), kb: true },
      ],
    },
    {
      icon: <ChatCircleDotsIcon />,
      title: "Chat",
      lines: [
        { keys: ["Enter"], text: t("Mulai mengetik"), kb: true },
        { text: t("Tab Area hanya terbaca orang yang bisa mendengarmu; Semua untuk seluruh kantor") },
        { text: t("Pesan langsung: buka daftar Anggota lalu klik ikon pesan") },
        { text: t("Kirim file (maks 5 MB), beri reaksi emoji, cari pesan, sebut orang dengan @username") },
      ],
    },
    {
      icon: <ChairIcon />,
      title: t("Meja & mode fokus"),
      lines: [
        { text: t("Datangi meja kosong lalu klik “Jadikan … mejaku”") },
        { text: t("Kunci mejamu (mode fokus): tidak ada yang bisa masuk dan statusmu jadi Fokus") },
      ],
    },
    {
      icon: <DoorIcon />,
      title: t("Ruangan & rapat"),
      lines: [
        { keys: ["F"], text: t("Buka/tutup pintu, atau ketuk bila terkunci") },
        { text: t("Dari dalam ruangan: kunci pintu — orang di luar hanya bisa mengetuk") },
        { text: t("Angkat tangan, mute semua, whiteboard bersama, jadwal booking ruangan") },
        { text: t("Layar: tampilkan website (slide, dashboard) untuk semua orang di ruangan") },
      ],
    },
    {
      icon: <ElevatorIcon />,
      title: t("Lantai & tempat"),
      lines: [
        { text: t("Naik lift untuk pindah lantai") },
        { keys: ["F"], text: t("Main game di mesin arcade atau meja permainan (lantai 2)") },
        { keys: ["C"], text: t("Duduk di kursi atau sofa / berdiri") },
      ],
    },
    {
      icon: <SmileyIcon />,
      title: t("Emote & orang lain"),
      lines: [
        { keys: ["1", "2", "3"], text: t("Lambai · jempol · joget"), kb: true },
        { text: t("Daftar Anggota: lihat status & lokasi, kirim pesan, pergi ke dekatnya, ikuti, atau panggil ke tempatmu") },
        { text: t("Status otomatis (tersedia, rapat, fokus, away) atau atur sendiri; tempel link kalender di Setelan") },
      ],
    },
    {
      icon: <MapTrifoldIcon />,
      title: t("Tampilan 2D & 3D"),
      lines: [{ text: t("Ganti kapan saja lewat tombol Tampilan di kiri atas atau di Setelan — posisi, chat & panggilan tetap") }],
    },
  ];
}

const isTouch = () => matchMedia("(max-width: 720px), (pointer: coarse)").matches;

/** Panel petunjuk lengkap (tombol ? di toolbar). */
export function HelpModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const active = useGraphics((s) => s.view);
  const [shown, setShown] = useState<View>(active);
  const touch = isTouch();
  useEffect(() => setShown(active), [active]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const other: View = shown === "2d" ? "3d" : "2d";
  return (
    <div className="overlay modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card help">
        <div className="side-head">
          <h2>
            <QuestionIcon /> {t("Petunjuk")}
          </h2>
          <button className="x" onClick={onClose} title={t("Tutup")}>
            ×
          </button>
        </div>
        <section>
          <h4>
            <FootprintsIcon /> {t("Bergerak & kamera")} · {shown === "2d" ? "2D" : "3D"}
            {shown !== active && <span className="tag">{t("bukan tampilan aktif")}</span>}
          </h4>
          <Lines lines={movement(t, shown, touch)} touch={false} />
          <button className="link plain" onClick={() => setShown(other)}>
            {t("Lihat versi {view}", { view: other === "2d" ? "2D" : "3D" })}
          </button>
        </section>
        {sections(t).map((s) => (
          <section key={s.title}>
            <h4>
              {s.icon} {s.title}
            </h4>
            <Lines lines={s.lines} touch={touch} />
          </section>
        ))}
        <p className="muted small">
          <LightbulbIcon /> {t("Arahkan kursor ke tombol mana pun untuk melihat fungsinya.")}
        </p>
        <button
          className="secondary"
          onClick={() => {
            onClose();
            startTour();
          }}
        >
          {t("Ulangi tur")}
        </button>
      </div>
    </div>
  );
}

/** `touch`: layar sentuh — baris khusus keyboard disembunyikan dan tombol keyboard tidak ditampilkan. */
function Lines({ lines, touch }: { lines: Line[]; touch: boolean }) {
  return (
    <ul className="help-lines">
      {lines
        .filter((l) => !(touch && l.kb))
        .map((l) => (
          <li key={l.text}>
            {l.keys && !touch && <Keys keys={l.keys} />} <span>{l.text}</span>
          </li>
        ))}
    </ul>
  );
}

// ---------- tur ----------

type Step = { icon: ReactNode; title: string; body: string; target?: string };

function steps(t: ReturnType<typeof useT>, view: View, touch: boolean): Step[] {
  const walk =
    touch && view === "2d"
      ? t("Geser joystick untuk jalan — dorong penuh untuk lari. Cubit layar untuk zoom; paling jauh menampilkan seluruh lantai.")
      : touch
        ? t("Geser joystick untuk jalan — dorong penuh untuk lari. Geser layar untuk memutar kamera.")
        : view === "2d"
          ? t("Jalan dengan WASD atau tombol panah — W selalu ke atas layar. Tahan Shift untuk lari. Scroll untuk zoom; paling jauh menampilkan seluruh lantai.")
          : t("Jalan dengan WASD atau tombol panah, mengikuti arah kamera. Tahan Shift untuk lari. Drag atau Q·E untuk memutar kamera, scroll untuk zoom.");
  return [
    { icon: <FootprintsIcon />, title: t("Selamat datang di kantor virtual!"), body: walk, target: touch ? ".joystick" : undefined },
    {
      icon: <MicrophoneIcon />,
      title: t("Ngobrol seperti di kantor sungguhan"),
      body: t("Di dalam area (ruangan, meja, lounge) semua orang di area itu saling mendengar dengan jelas. Di luar area, suara terdengar dalam radius 4 m. Nyalakan mic (M), kamera (V), atau share screen dari tombol di bawah."),
      target: ".media-bar",
    },
    {
      icon: <ChatCircleDotsIcon />,
      title: "Chat",
      body: t("Tab Area hanya terbaca orang yang bisa mendengarmu, Semua untuk seluruh kantor, dan pesan langsung lewat daftar Anggota. Tekan Enter untuk mulai mengetik."),
      target: touch ? ".toolbar .tool" : ".chat, .chat-toggle",
    },
    {
      icon: <ChairIcon />,
      title: t("Meja & mode fokus"),
      body: t("Datangi meja kosong lalu klik “Jadikan … mejaku”. Kunci mejamu (mode fokus) supaya tidak ada yang masuk dan statusmu jadi Fokus."),
    },
    {
      icon: <DoorIcon />,
      title: t("Ruangan rapat"),
      body: t("Buka/tutup pintu dengan F, duduk dengan C. Dari dalam ruangan kamu bisa mengunci pintu (orang di luar hanya bisa mengetuk), angkat tangan, mute semua, buka whiteboard, booking jadwal, dan menampilkan website di layar."),
    },
    {
      icon: <ElevatorIcon />,
      title: t("Lantai & town hall"),
      body: t("Naik lift untuk pindah lantai. Di town hall, siapa pun yang berdiri di panggung terdengar oleh seluruh ruangan. Lantai 2 berisi arcade dan permainan."),
    },
    {
      icon: <QuestionIcon />,
      title: t("Butuh bantuan?"),
      body: t("Buka petunjuk lengkap kapan saja lewat tombol ? di kanan atas. Arahkan kursor ke tombol mana pun untuk melihat fungsinya."),
      target: ".tool.help",
    },
  ];
}

/** Kotak elemen yang disorot (diperbarui berkala karena HUD bisa bergeser/muncul). */
function useTargetRect(sel?: string) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!sel) return setRect(null);
    const read = () => {
      const el = document.querySelector(sel);
      const r = el?.getBoundingClientRect();
      setRect((old) => (r && r.width > 0 ? (old && old.x === r.x && old.y === r.y && old.width === r.width && old.height === r.height ? old : r) : null));
    };
    read();
    const id = setInterval(read, 300);
    window.addEventListener("resize", read);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", read);
    };
  }, [sel]);
  return rect;
}

export function Tour() {
  const t = useT();
  const step = useGuide((s) => s.step);
  const view = useGraphics((s) => s.view);
  const list = steps(t, view, isTouch());
  const cur = step === null ? null : list[step];
  const rect = useTargetRect(cur?.target);

  const close = () => {
    useGuide.setState({ step: null });
    finishTour(); // selesai atau dilewati sama-sama dicatat: tidak muncul otomatis lagi
  };
  useEffect(() => {
    if (step === null) return;
    // Hanya Esc (lewati): tombol panah tetap untuk berjalan.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (step === null || !cur) return null;

  const last = step === list.length - 1;
  // Kartu di bawah sasaran bila sasaran di separuh atas layar, di atasnya bila di bawah; tanpa sasaran di bawah
  // tengah layar supaya avatar (di tengah) tetap terlihat.
  const pad = 8;
  const style: React.CSSProperties = rect
    ? {
        left: Math.min(Math.max(16, rect.left + rect.width / 2 - 170), innerWidth - 356),
        ...(rect.top + rect.height / 2 < innerHeight / 2 ? { top: rect.bottom + pad + 12 } : { bottom: innerHeight - rect.top + pad + 12 }),
      }
    : { left: "50%", top: "58%", transform: "translateX(-50%)" };
  return (
    <div className="tour" role="dialog" aria-label={t("Tur singkat")}>
      {rect ? (
        <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-card" style={style}>
        <h3>
          {cur.icon} {cur.title}
        </h3>
        <p>{cur.body}</p>
        <div className="tour-actions">
          <span className="muted small">{t("{n} dari {total}", { n: step + 1, total: list.length })}</span>
          <button className="link plain" onClick={close} title={t("Tutup tur — bisa diulang dari tombol ?")}>
            {t("Lewati")}
          </button>
          {step > 0 && (
            <button className="secondary small" onClick={() => useGuide.setState({ step: step - 1 })}>
              {t("Kembali")}
            </button>
          )}
          <button className="primary small" onClick={() => (last ? close() : useGuide.setState({ step: step + 1 }))}>
            {last ? t("Selesai") : t("Lanjut")}
          </button>
        </div>
      </div>
    </div>
  );
}
