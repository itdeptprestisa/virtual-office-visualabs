import { useState } from "react";
import { logout, sendSettings, useNet } from "../net";
import { notifyPermission, requestNotifyPermission, setSoundsEnabled, soundsEnabled } from "../notify";

/** Setelan akun: nama, kalender (iCal), notifikasi & suara, keluar. */
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const me = useNet((s) => s.me)!;
  const [name, setName] = useState(me.name);
  const [ical, setIcal] = useState(me.ical ?? "");
  const [perm, setPerm] = useState(notifyPermission());
  const [sounds, setSounds] = useState(soundsEnabled());

  const save = () => {
    sendSettings({ name: name.trim() || me.name, ical: ical.trim() });
    onClose();
  };

  return (
    <div className="overlay modal" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="card settings">
        <h2>⚙️ Setelan</h2>
        <p className="muted small">
          Masuk sebagai <b>@{me.username}</b>
          {me.role === "admin" && " · admin"}
        </p>
        <label>
          Nama tampilan
          <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Kalender (link iCal rahasia)
          <input value={ical} onChange={(e) => setIcal(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" />
          <span className="muted small">
            Google Calendar → Setelan → pilih kalender → <i>Alamat rahasia dalam format iCal</i>. Selama ada acara, statusmu otomatis jadi <b>Rapat</b>.
            Judul acara tidak ditampilkan ke orang lain.
          </span>
        </label>
        <div className="setting-row">
          <span>Notifikasi desktop (saat tab tidak dibuka)</span>
          {perm === "granted" ? (
            <span className="muted">Aktif ✓</span>
          ) : perm === "denied" ? (
            <span className="muted small">Diblokir — izinkan dari setelan browser</span>
          ) : (
            <button className="secondary small" onClick={() => requestNotifyPermission().then((p) => setPerm(p as NotificationPermission))}>
              Aktifkan
            </button>
          )}
        </div>
        <label className="setting-row">
          <span>Suara notifikasi</span>
          <input
            type="checkbox"
            checked={sounds}
            onChange={(e) => {
              setSounds(e.target.checked);
              setSoundsEnabled(e.target.checked);
            }}
          />
        </label>
        <div className="editor-footer">
          <button className="secondary danger-text" onClick={logout}>
            Keluar akun
          </button>
          <span style={{ flex: 1 }} />
          <button className="secondary" onClick={onClose}>
            Batal
          </button>
          <button className="primary" onClick={save}>
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
