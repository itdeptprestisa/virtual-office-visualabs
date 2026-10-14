// Suara notifikasi (dibangkitkan Web Audio, tanpa file) + notifikasi desktop saat tab tidak sedang dilihat.

type Kind = "message" | "mention" | "summon" | "knock";

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.18) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.05);
}

export function playSound(kind: Kind) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    return;
  }
  switch (kind) {
    case "message":
      tone(880, 0, 0.12);
      tone(1320, 0.08, 0.16);
      break;
    case "mention":
      tone(988, 0, 0.12);
      tone(1319, 0.1, 0.12);
      tone(1760, 0.2, 0.2);
      break;
    case "summon":
      [660, 880, 1100, 1320].forEach((f, i) => tone(f, i * 0.11, 0.3, "triangle", 0.15));
      break;
    case "knock":
      // dua ketukan kayu: nada rendah, sangat pendek
      [0, 0.18].forEach((t) => {
        tone(180, t, 0.09, "square", 0.25);
        tone(95, t, 0.12, "sine", 0.35);
      });
      break;
  }
}

let soundsOn = (() => {
  try {
    return localStorage.getItem("vo-sounds") !== "off";
  } catch {
    return true;
  }
})();

export const soundsEnabled = () => soundsOn;
export function setSoundsEnabled(on: boolean) {
  soundsOn = on;
  try {
    localStorage.setItem("vo-sounds", on ? "on" : "off");
  } catch {
    /* abaikan */
  }
}

export const canNotify = () => typeof Notification !== "undefined";
export const notifyPermission = () => (canNotify() ? Notification.permission : "denied");
export const requestNotifyPermission = () => (canNotify() ? Notification.requestPermission() : Promise.resolve("denied"));

/** `quiet`: hanya suara pelan bila tab aktif (mis. chat biasa); notifikasi desktop tetap bila tab tersembunyi. */
export function notify(kind: Kind, title: string, body: string, opts: { quiet?: boolean } = {}) {
  if (soundsOn && (!opts.quiet || document.hidden)) playSound(kind);
  if (document.hidden && notifyPermission() === "granted") {
    try {
      new Notification(title, { body, tag: kind === "message" ? undefined : kind });
    } catch {
      /* beberapa browser menolak Notification di luar service worker */
    }
  }
}
