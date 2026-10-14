import { resetLayout, sendAdmin, useNet } from "../net";
import { useEditor } from "../editor";

/** Admin: pengguna (peran, keluarkan, nonaktifkan), pendaftaran (terbuka / kode undangan), editor denah. */
export function AdminPanel({ onClose }: { onClose: () => void }) {
  const admin = useNet((s) => s.admin);
  const selfId = useNet((s) => s.selfId);
  const editing = useEditor((s) => s.active);
  if (!admin) return null;

  return (
    <aside className="side-panel wide">
      <div className="side-head">
        <b>🛠️ Admin</b>
        <button className="x" onClick={onClose} aria-label="Tutup">
          ×
        </button>
      </div>

      <section>
        <h4>Denah kantor</h4>
        <div className="row-actions">
          <button className={editing ? "primary small" : "secondary small"} onClick={() => useEditor.setState({ active: !editing, selected: null })}>
            {editing ? "✓ Selesai mengedit" : "✏️ Edit denah"}
          </button>
          <button className="secondary small" onClick={() => confirm("Kembalikan denah ke bawaan? Furnitur & ruangan yang diubah akan hilang.") && resetLayout()}>
            Reset ke bawaan
          </button>
        </div>
      </section>

      <section>
        <h4>Pendaftaran</h4>
        <label className="setting-row">
          <span>Hanya dengan kode undangan</span>
          <input
            type="checkbox"
            checked={admin.registration === "invite"}
            onChange={(e) => sendAdmin({ action: "registration", mode: e.target.checked ? "invite" : "open" })}
          />
        </label>
        {admin.registration === "invite" && (
          <div className="setting-row">
            <span>
              Kode: <code>{admin.inviteCode}</code>
            </span>
            <span className="row-actions">
              <button className="secondary small" onClick={() => navigator.clipboard?.writeText(admin.inviteCode)}>
                Salin
              </button>
              <button className="secondary small" onClick={() => sendAdmin({ action: "new_invite" })}>
                Buat baru
              </button>
            </span>
          </div>
        )}
      </section>

      <section>
        <h4>Pengguna ({admin.users.length})</h4>
        <ul className="members admin">
          {admin.users.map((u) => (
            <li key={u.id} className={u.disabled ? "offline" : ""}>
              <span className="dot" style={{ background: u.online ? "#3fb26b" : "#b7b2aa" }} />
              <div className="who">
                <b>{u.name}</b> <span className="muted small">@{u.username}</span>
                {u.disabled && <span className="tag">nonaktif</span>}
              </div>
              {u.id === selfId ? (
                <span className="muted small">kamu</span>
              ) : (
                <div className="actions">
                  <select value={u.role} onChange={(e) => sendAdmin({ action: "role", userId: u.id, role: e.target.value })} aria-label="Peran">
                    <option value="member">Anggota</option>
                    <option value="admin">Admin</option>
                  </select>
                  {u.online && (
                    <button title="Keluarkan dari kantor" onClick={() => sendAdmin({ action: "kick", userId: u.id })}>
                      ⏏️
                    </button>
                  )}
                  {u.disabled ? (
                    <button title="Aktifkan akun" onClick={() => sendAdmin({ action: "enable", userId: u.id })}>
                      ♻️
                    </button>
                  ) : (
                    <button title="Nonaktifkan akun" onClick={() => confirm(`Nonaktifkan akun ${u.name}?`) && sendAdmin({ action: "disable", userId: u.id })}>
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
