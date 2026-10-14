import { useState } from "react";
import { resetLayout, sendAdmin, showNotice, useNet } from "../net";
import { useEditor } from "../editor";
import { locale, t, useT } from "../i18n";

const NO_LINKS: never[] = [];
const guestUrl = (token: string) => `${location.origin}${location.pathname}?guest=${encodeURIComponent(token)}`;

function GuestLinks() {
  const t = useT();
  const links = useNet((s) => s.admin?.guestLinks ?? NO_LINKS);
  const [label, setLabel] = useState("");
  const [hours, setHours] = useState(24);
  return (
    <section>
      <h4>{t("Link tamu")}</h4>
      <p className="muted small">{t("Untuk klien/tamu tanpa akun. Tamu tidak bisa klaim meja atau booking ruangan; akunnya terhapus otomatis saat link berakhir.")}</p>
      <div className="row-actions">
        <input className="ed-input" placeholder={t("Label, mis. Klien PT Maju")} value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />
        <select value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label={t("Masa berlaku")}>
          <option value={2}>{t("{n} jam", { n: 2 })}</option>
          <option value={8}>{t("{n} jam", { n: 8 })}</option>
          <option value={24}>{t("1 hari")}</option>
          <option value={72}>{t("{n} hari", { n: 3 })}</option>
          <option value={168}>{t("{n} hari", { n: 7 })}</option>
        </select>
        <button
          className="secondary small"
          onClick={() => {
            sendAdmin({ action: "guest_link", hours, label: label.trim() || t("Tamu") });
            setLabel("");
          }}
        >
          {t("Buat link")}
        </button>
      </div>
      <ul className="members admin">
        {links.map((g) => (
          <li key={g.token}>
            <div className="who">
              <b>{g.label}</b>
              <div className="muted small">
                {t("s/d")} {new Date(g.exp).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" })}
              </div>
            </div>
            <div className="actions">
              <button
                title={t("Salin link")}
                onClick={() => {
                  navigator.clipboard?.writeText(guestUrl(g.token));
                  showNotice(`🔗 ${t("Link tamu disalin")}`);
                }}
              >
                🔗
              </button>
              <button title={t("Cabut link")} onClick={() => sendAdmin({ action: "guest_revoke", token: g.token })}>
                🗑️
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Password sementara hasil reset — hanya ditampilkan sekali ke admin. */
export function TempPasswordModal() {
  const t = useT();
  const temp = useNet((s) => s.tempPassword);
  if (!temp) return null;
  return (
    <div className="overlay modal">
      <div className="card">
        <h2>🔑 {t("Password sementara")}</h2>
        <p>{t("Berikan ke @{username} lewat jalur pribadi. Minta dia menggantinya di ⚙️ Setelan setelah masuk.", { username: temp.username })}</p>
        <code className="big">{temp.password}</code>
        <div className="editor-footer">
          <button className="secondary" onClick={() => navigator.clipboard?.writeText(temp.password)}>
            {t("Salin")}
          </button>
          <button className="primary" onClick={() => useNet.setState({ tempPassword: null })}>
            {t("Selesai")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Admin: pengguna (peran, reset password, keluarkan, nonaktifkan), pendaftaran, link tamu, editor denah. */
export function AdminPanel({ onClose }: { onClose: () => void }) {
  useT();
  const admin = useNet((s) => s.admin);
  const selfId = useNet((s) => s.selfId);
  const editing = useEditor((s) => s.active);
  if (!admin) return null;

  return (
    <aside className="side-panel wide">
      <div className="side-head">
        <b>🛠️ Admin</b>
        <button className="x" onClick={onClose} aria-label={t("Tutup")}>
          ×
        </button>
      </div>

      <section>
        <h4>{t("Denah kantor")}</h4>
        <div className="row-actions">
          <button className={editing ? "primary small" : "secondary small"} onClick={() => useEditor.setState({ active: !editing, selected: null })}>
            {editing ? `✓ ${t("Selesai mengedit")}` : `✏️ ${t("Edit denah")}`}
          </button>
          <button className="secondary small" onClick={() => confirm(t("Kembalikan denah ke bawaan? Furnitur & ruangan yang diubah akan hilang.")) && resetLayout()}>
            {t("Reset ke bawaan")}
          </button>
        </div>
      </section>

      <section>
        <h4>{t("Pendaftaran")}</h4>
        <label className="setting-row">
          <span>{t("Hanya dengan kode undangan")}</span>
          <input
            type="checkbox"
            checked={admin.registration === "invite"}
            onChange={(e) => sendAdmin({ action: "registration", mode: e.target.checked ? "invite" : "open" })}
          />
        </label>
        {admin.registration === "invite" && (
          <div className="setting-row">
            <span>
              {t("Kode")}: <code>{admin.inviteCode}</code>
            </span>
            <span className="row-actions">
              <button className="secondary small" onClick={() => navigator.clipboard?.writeText(admin.inviteCode)}>
                {t("Salin")}
              </button>
              <button className="secondary small" onClick={() => sendAdmin({ action: "new_invite" })}>
                {t("Buat baru")}
              </button>
            </span>
          </div>
        )}
      </section>

      <GuestLinks />

      <section>
        <h4>
          {t("Pengguna")} ({admin.users.length})
        </h4>
        <ul className="members admin">
          {admin.users.map((u) => (
            <li key={u.id} className={u.disabled ? "offline" : ""}>
              <span className="dot" style={{ background: u.online ? "#3fb26b" : "#b7b2aa" }} />
              <div className="who">
                <b>{u.name}</b> <span className="muted small">@{u.username}</span>
                {u.disabled && <span className="tag">{t("nonaktif")}</span>}
                {u.role === "guest" && <span className="tag">{t("tamu")}</span>}
              </div>
              {u.id === selfId ? (
                <span className="muted small">{t("kamu")}</span>
              ) : (
                <div className="actions">
                  {u.role !== "guest" && (
                    <select value={u.role} onChange={(e) => sendAdmin({ action: "role", userId: u.id, role: e.target.value })} aria-label={t("Peran")}>
                      <option value="member">{t("Anggota")}</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                  {u.role !== "guest" && (
                    <button
                      title={t("Reset password")}
                      onClick={() => confirm(t("Reset password {name}? Semua sesinya akan dikeluarkan.", { name: u.name })) && sendAdmin({ action: "reset_password", userId: u.id })}
                    >
                      🔑
                    </button>
                  )}
                  {u.online && (
                    <button title={t("Keluarkan dari kantor")} onClick={() => sendAdmin({ action: "kick", userId: u.id })}>
                      ⏏️
                    </button>
                  )}
                  {u.disabled ? (
                    <button title={t("Aktifkan akun")} onClick={() => sendAdmin({ action: "enable", userId: u.id })}>
                      ♻️
                    </button>
                  ) : (
                    <button title={t("Nonaktifkan akun")} onClick={() => confirm(t("Nonaktifkan akun {name}?", { name: u.name })) && sendAdmin({ action: "disable", userId: u.id })}>
                      🚫
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
