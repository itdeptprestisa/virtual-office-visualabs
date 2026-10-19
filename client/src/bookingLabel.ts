// Teks label jadwal di atas pintu ruangan (dipakai 3D & 2D): yang sedang berlangsung, atau booking berikutnya hari ini.
import type { Booking } from "./net";
import { locale, t } from "./i18n";

const hhmm = (ts: number) => new Date(ts).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });

export function bookingLabel(roomId: string, bookings: Booking[], now: number): { now: boolean; text: string } | null {
  const mine = bookings.filter((b) => b.room === roomId && b.end > now);
  const current = mine.find((b) => b.start <= now);
  if (current) return { now: true, text: `${current.title} · ${t("s/d")} ${hhmm(current.end)}` };
  const next = mine.find((b) => new Date(b.start).toDateString() === new Date(now).toDateString());
  return next ? { now: false, text: `${t("Berikutnya")} ${hhmm(next.start)} · ${next.title}` } : null;
}
