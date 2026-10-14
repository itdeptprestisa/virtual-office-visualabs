// Status "Rapat" otomatis dari kalender: membaca link iCal rahasia (Google Calendar → Setelan → "Alamat rahasia
// dalam format iCal"). Mendukung acara biasa, zona waktu (TZID), dan pengulangan DAILY/WEEKLY sederhana.

export interface CalEvent {
  start: number; // ms UTC
  end: number;
  title: string;
  rrule: Record<string, string> | null;
  exdates: number[];
}

function unfold(text: string) {
  return text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

/** Offset (ms) zona waktu `tz` pada saat `utc`: waktu lokal − UTC. */
function tzOffset(utc: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - utc;
}

function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string) {
  const guess = Date.UTC(y, mo, d, h, mi, s);
  try {
    let utc = guess - tzOffset(guess, tz);
    utc = guess - tzOffset(utc, tz); // koreksi di sekitar pergantian DST
    return utc;
  } catch {
    return guess; // TZID tak dikenal → anggap UTC
  }
}

/** null = acara seharian (diabaikan untuk status). */
export function parseDate(value: string, params: Record<string, string>): number | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m || params.VALUE === "DATE" || !m[4]) return null;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number);
  if (m[7]) return Date.UTC(y, mo - 1, d, h, mi, s);
  if (params.TZID) return zonedToUtc(y, mo - 1, d, h, mi, s, params.TZID);
  return new Date(y, mo - 1, d, h, mi, s).getTime(); // waktu "mengambang" = zona server
}

function parseDuration(v: string) {
  const m = v.match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const [w, d, h, mi, s] = m.slice(1).map((x) => Number(x ?? 0));
  return ((((w * 7 + d) * 24 + h) * 60 + mi) * 60 + s) * 1000;
}

export function parseIcs(text: string): CalEvent[] {
  const events: CalEvent[] = [];
  let cur: Record<string, { value: string; params: Record<string, string> }[]> | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) {
      const one = (k: string) => cur![k]?.[0];
      const status = one("STATUS")?.value;
      const transp = one("TRANSP")?.value;
      const ds = one("DTSTART");
      const start = ds ? parseDate(ds.value, ds.params) : null;
      if (start !== null && status !== "CANCELLED" && transp !== "TRANSPARENT") {
        const de = one("DTEND");
        const dur = one("DURATION");
        const end = de ? parseDate(de.value, de.params) : dur ? start + parseDuration(dur.value) : start + 3600_000;
        const rr = one("RRULE")?.value;
        events.push({
          start,
          end: end ?? start + 3600_000,
          title: one("SUMMARY")?.value ?? "",
          rrule: rr ? Object.fromEntries(rr.split(";").map((kv) => kv.split("=") as [string, string])) : null,
          exdates: (cur.EXDATE ?? []).flatMap((e) => e.value.split(",").map((v) => parseDate(v, e.params) ?? -1)),
        });
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const [name, ...paramParts] = line.slice(0, idx).split(";");
      const params = Object.fromEntries(paramParts.map((p) => p.split("=") as [string, string]));
      (cur[name] ??= []).push({ value: line.slice(idx + 1), params });
    }
  }
  return events;
}

const DAY = 86_400_000;
const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Acara yang sedang berlangsung pada `now`, bila ada. */
export function busyAt(events: CalEvent[], now: number): CalEvent | null {
  for (const ev of events) {
    const len = ev.end - ev.start;
    if (!ev.rrule) {
      if (ev.start <= now && now < ev.end) return ev;
      continue;
    }
    const freq = ev.rrule.FREQ;
    if (freq !== "DAILY" && freq !== "WEEKLY") continue;
    const interval = Math.max(1, Number(ev.rrule.INTERVAL ?? 1));
    const until = ev.rrule.UNTIL ? parseDate(ev.rrule.UNTIL.replace(/^(\d{8})$/, "$1T235959Z"), {}) ?? Infinity : Infinity;
    const count = ev.rrule.COUNT ? Number(ev.rrule.COUNT) : Infinity;
    const byDay = ev.rrule.BYDAY?.split(",").map((d) => WEEKDAYS.indexOf(d.slice(-2))) ?? null;
    let n = 0;
    // Iterasi per hari sejak awal; cukup untuk pengulangan harian/mingguan (dibatasi 3 tahun).
    for (let day = 0; day < 1100; day++) {
      const occ = ev.start + day * DAY;
      if (occ > now || occ > until || n >= count) break;
      const weekIdx = Math.floor(day / 7);
      let hit: boolean;
      if (freq === "DAILY") hit = day % interval === 0;
      else hit = weekIdx % interval === 0 && (byDay ? byDay.includes(new Date(occ).getUTCDay()) : day % 7 === 0);
      if (!hit) continue;
      n++;
      if (ev.exdates.includes(occ)) continue;
      if (occ <= now && now < occ + len) return ev;
    }
  }
  return null;
}

export async function fetchCalendar(url: string): Promise<CalEvent[]> {
  const res = await fetch(url.replace(/^webcal:/, "https:"), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseIcs(await res.text());
}
