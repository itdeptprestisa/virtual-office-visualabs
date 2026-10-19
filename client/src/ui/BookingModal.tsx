import { useMemo, useState } from "react";
import { sendBooking, sendUnbook, useNet } from "../net";
import { locale, place, t, useT } from "../i18n";
import { CalendarBlankIcon } from "./icons";

const pad = (n: number) => String(n).padStart(2, "0");
const dateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmt = (ts: number) => new Date(ts).toLocaleString(locale(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const hhmm = (ts: number) => new Date(ts).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });

/** Jadwal & booking ruangan. Bentrok jadwal ditolak server. */
export function BookingModal() {
  useT();
  const roomId = useNet((s) => s.openBooking);
  // Selector mengembalikan objek dari state apa adanya; daftar turunannya dibuat dengan useMemo
  // (membuat array baru di dalam selector memicu render tanpa henti).
  const layout = useNet((s) => s.layout);
  const rooms = useMemo(() => layout?.floors.flatMap((f) => f.rooms.map((r) => ({ ...r, floorName: f.name }))) ?? [], [layout]);
  const bookings = useNet((s) => s.bookings);
  const selfId = useNet((s) => s.selfId);
  const isAdmin = useNet((s) => s.me?.role === "admin");
  // Waktu awal default: kelipatan 30 menit berikutnya.
  const [start] = useState(() => {
    const d = new Date(Date.now() + 30 * 60_000);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    return d;
  });
  const [room, setRoom] = useState(roomId ?? "");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(dateInput(start));
  const [time, setTime] = useState(timeInput(start));
  const [minutes, setMinutes] = useState(30);
  if (!roomId) return null;
  const close = () => useNet.setState({ openBooking: null });
  const selected = room || roomId;
  const list = bookings.filter((b) => b.room === selected);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = new Date(`${date}T${time}`).getTime();
    if (!Number.isFinite(s)) return;
    sendBooking(selected, title.trim() || t("Rapat"), s, s + minutes * 60_000);
    setTitle("");
  };

  return (
    <div className="overlay modal" onKeyDown={(e) => e.key === "Escape" && close()}>
      <div className="card booking">
        <div className="side-head">
          <h2>
          <CalendarBlankIcon /> {t("Jadwal ruangan")}
        </h2>
          <button className="x" onClick={close} aria-label={t("Tutup")} title={t("Tutup")}>
            ×
          </button>
        </div>
        <select value={selected} onChange={(e) => setRoom(e.target.value)} aria-label={t("Ruangan")}>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {place(r.name)} · {place(r.floorName)}
            </option>
          ))}
        </select>
        <ul className="bookings">
          {list.length === 0 && <li className="muted">{t("Belum ada booking. Ruangan bebas dipakai.")}</li>}
          {list.map((b) => (
            <li key={b.id} className={b.start <= Date.now() ? "now" : ""}>
              <div>
                <b>{b.title}</b>
                <div className="muted small">
                  {fmt(b.start)}–{hhmm(b.end)} · {b.byName}
                </div>
              </div>
              {(b.by === selfId || isAdmin) && (
                <button className="link" onClick={() => sendUnbook(b.id)}>
                  {t("Batalkan")}
                </button>
              )}
            </li>
          ))}
        </ul>
        <form className="booking-form" onSubmit={submit}>
          <h4>{t("Booking baru")}</h4>
          <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder={t("Judul, mis. Sprint review")} />
          <div className="row-actions">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("Tanggal")} />
            <input type="time" value={time} step={900} onChange={(e) => setTime(e.target.value)} aria-label={t("Jam mulai")} />
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label={t("Durasi")}>
              {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? t("{n} menit", { n: m }) : t("{n} jam", { n: m / 60 })}
                </option>
              ))}
            </select>
          </div>
          <button className="primary">{t("Booking")}</button>
        </form>
      </div>
    </div>
  );
}
