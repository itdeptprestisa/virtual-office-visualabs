import { useEffect, useState } from "react";
import { logout, sendPassword, sendSettings, showNotice, useNet } from "../net";
import { notifyPermission, requestNotifyPermission, setSoundsEnabled, soundsEnabled } from "../notify";
import { chooseDevice, listDevices, setNoiseSuppression, setPushToTalk, usePrefs } from "../media";
import { locale, useT } from "../i18n";
import { LangSwitch } from "./AuthScreen";

type Devices = Awaited<ReturnType<typeof listDevices>>;

function DeviceSelect({ label, list, value, onChange }: { label: string; list: MediaDeviceInfo[]; value?: string; onChange: (id: string) => void }) {
  if (!list.length) return null;
  return (
    <label className="setting-row">
      <span>{label}</span>
      <select value={value ?? list[0].deviceId} onChange={(e) => onChange(e.target.value)}>
        {list.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>
            {d.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Setelan akun: bahasa, profil, kalender, password, audio/video, notifikasi, keluar. */
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const me = useNet((s) => s.me)!;
  const guest = me.role === "guest";
  const [name, setName] = useState(me.name);
  const [ical, setIcal] = useState(me.ical ?? "");
  const [perm, setPerm] = useState(notifyPermission());
  const [sounds, setSounds] = useState(soundsEnabled());
  const [pw, setPw] = useState({ old: "", next: "", again: "" });
  const [devices, setDevices] = useState<Devices | null>(null);
  const prefs = usePrefs();

  useEffect(() => {
    listDevices().then(setDevices).catch(() => setDevices(null));
  }, []);

  const save = () => {
    sendSettings(guest ? { name: name.trim() || me.name } : { name: name.trim() || me.name, ical: ical.trim() });
    onClose();
  };

  const changePassword = () => {
    if (pw.next.length < 6) return showNotice(t("Password baru minimal 6 karakter."));
    if (pw.next !== pw.again) return showNotice(t("Konfirmasi password baru tidak sama."));
    sendPassword(pw.old, pw.next);
    setPw({ old: "", next: "", again: "" });
  };

  const noLabels = devices && [...devices.mics, ...devices.cams].every((d) => !d.label);

  return (
    <div className="overlay modal" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="card settings">
        <div className="auth-head">
          <h2>⚙️ {t("Setelan")}</h2>
          <LangSwitch />
        </div>
        <p className="muted small">
          {guest ? (
            <>
              {t("Akun tamu · berlaku sampai")}{" "}
              <b>{new Date(me.guestExp!).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" })}</b>
            </>
          ) : (
            <>
              {t("Masuk sebagai")} <b>@{me.username}</b>
              {me.role === "admin" && " · admin"}
            </>
          )}
        </p>

        <section>
          <h4>{t("Profil")}</h4>
          <label>
            {t("Nama tampilan")}
            <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          </label>
          {!guest && (
            <label>
              {t("Kalender (link iCal rahasia)")}
              <input value={ical} onChange={(e) => setIcal(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" />
              <span className="muted small">
                {t("Google Calendar → Setelan → pilih kalender → Alamat rahasia dalam format iCal. Selama ada acara, statusmu otomatis jadi Rapat. Judul acara tidak ditampilkan ke orang lain.")}
              </span>
            </label>
          )}
        </section>

        <section>
          <h4>{t("Audio & video")}</h4>
          {noLabels && <p className="muted small">{t("Nyalakan mic/kamera sekali supaya nama perangkat muncul di sini.")}</p>}
          {devices && (
            <>
              <DeviceSelect label={t("Mikrofon")} list={devices.mics} value={prefs.mic} onChange={(id) => chooseDevice("mic", id)} />
              <DeviceSelect label={t("Kamera")} list={devices.cams} value={prefs.cam} onChange={(id) => chooseDevice("cam", id)} />
              <DeviceSelect label={t("Speaker")} list={devices.speakers} value={prefs.speaker} onChange={(id) => chooseDevice("speaker", id)} />
            </>
          )}
          <label className="setting-row">
            <span>
              {t("Peredam bising")}
              <span className="muted small"> · {t("juga pembatal gema & volume otomatis")}</span>
            </span>
            <input type="checkbox" checked={prefs.noiseSuppression} onChange={(e) => setNoiseSuppression(e.target.checked)} />
          </label>
          <label className="setting-row">
            <span>
              Push-to-talk
              <span className="muted small"> · {t("tahan Spasi untuk bicara")}</span>
            </span>
            <input type="checkbox" checked={prefs.ptt} onChange={(e) => setPushToTalk(e.target.checked)} />
          </label>
        </section>

        {!guest && (
          <section>
            <h4>{t("Ganti password")}</h4>
            <div className="pw-grid">
              <input type="password" autoComplete="current-password" placeholder={t("Password lama")} value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} />
              <input type="password" autoComplete="new-password" placeholder={t("Password baru (min. 6)")} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              <input type="password" autoComplete="new-password" placeholder={t("Ulangi password baru")} value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} />
              <button className="secondary small" disabled={!pw.old || !pw.next} onClick={changePassword}>
                {t("Ganti password")}
              </button>
            </div>
          </section>
        )}

        <section>
          <h4>{t("Notifikasi")}</h4>
          <div className="setting-row">
            <span>{t("Notifikasi desktop (saat tab tidak dibuka)")}</span>
            {perm === "granted" ? (
              <span className="muted">{t("Aktif")} ✓</span>
            ) : perm === "denied" ? (
              <span className="muted small">{t("Diblokir — izinkan dari setelan browser")}</span>
            ) : (
              <button className="secondary small" onClick={() => requestNotifyPermission().then((p) => setPerm(p as NotificationPermission))}>
                {t("Aktifkan")}
              </button>
            )}
          </div>
          <label className="setting-row">
            <span>{t("Suara notifikasi")}</span>
            <input
              type="checkbox"
              checked={sounds}
              onChange={(e) => {
                setSounds(e.target.checked);
                setSoundsEnabled(e.target.checked);
              }}
            />
          </label>
        </section>

        <div className="editor-footer">
          <button className="secondary danger-text" onClick={logout}>
            {t("Keluar akun")}
          </button>
          <span style={{ flex: 1 }} />
          <button className="secondary" onClick={onClose}>
            {t("Batal")}
          </button>
          <button className="primary" onClick={save}>
            {t("Simpan")}
          </button>
        </div>
      </div>
    </div>
  );
}
