import { openChatTab, remoteState, sendStatus, sendSummon, showNotice, useNet, type DirUser, type Presence } from "../net";
import { teleportNear } from "../Player";

export const STATUS: Record<Presence, { label: string; color: string }> = {
  available: { label: "Tersedia", color: "#3fb26b" },
  busy: { label: "Sibuk", color: "#e5484d" },
  focus: { label: "Fokus", color: "#e8743b" },
  meeting: { label: "Rapat", color: "#8b5cf6" },
  away: { label: "Away", color: "#e0a930" },
  offline: { label: "Offline", color: "#b7b2aa" },
};

export function StatusDot({ status }: { status: Presence }) {
  return <span className="dot" style={{ background: STATUS[status].color }} title={STATUS[status].label} />;
}

function locate(u: DirUser) {
  const s = remoteState.get(u.id);
  if (!s) return;
  teleportNear(s.p[0], s.p[2]);
  showNotice(`📍 Pindah ke dekat ${u.name}${u.zone ? ` (${u.zone})` : ""}`);
}

/** Daftar anggota: status, lokasi, angkat tangan; DM / cari / panggil. */
export function MemberPanel({ onClose }: { onClose: () => void }) {
  const users = useNet((s) => s.directory);
  const selfId = useNet((s) => s.selfId);
  const manual = useNet((s) => s.manualStatus);
  const me = users.find((u) => u.id === selfId);
  const others = users
    .filter((u) => u.id !== selfId)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  const online = others.filter((u) => u.online).length;

  return (
    <aside className="side-panel">
      <div className="side-head">
        <b>👥 Anggota</b>
        <span className="muted small">
          {online + 1} online · {users.length} terdaftar
        </span>
        <button className="x" onClick={onClose} aria-label="Tutup">
          ×
        </button>
      </div>
      {me && (
        <div className="me-status">
          <StatusDot status={me.status} />
          <span>
            Statusmu: <b>{STATUS[me.status].label}</b>
            {me.calendar && <span className="muted small"> · dari kalender</span>}
          </span>
          <select value={manual} onChange={(e) => sendStatus({ manual: e.target.value as "available" | "busy" | "away" })} aria-label="Atur status">
            <option value="available">Otomatis</option>
            <option value="busy">Sibuk (jangan diganggu)</option>
            <option value="away">Away</option>
          </select>
        </div>
      )}
      <ul className="members">
        {others.map((u) => (
          <li key={u.id} className={u.online ? "" : "offline"}>
            <StatusDot status={u.status} />
            <div className="who">
              <div>
                {u.hand && "✋ "}
                <b>{u.name}</b> <span className="muted small">@{u.username}</span>
                {u.role === "admin" && <span className="tag">admin</span>}
              </div>
              <div className="muted small">
                {STATUS[u.status].label}
                {u.calendar && " (kalender)"}
                {u.online && u.zone && ` · ${u.zone}`}
              </div>
            </div>
            <div className="actions">
              <button title="Kirim pesan" onClick={() => openChatTab(`dm:${u.id}`)}>
                💬
              </button>
              {u.online && (
                <>
                  <button title="Pergi ke dekatnya" onClick={() => locate(u)}>
                    📍
                  </button>
                  <button
                    title="Panggil ke tempatku"
                    onClick={() => {
                      sendSummon(u.id);
                      showNotice(`📣 ${u.name} dipanggil ke tempatmu`);
                    }}
                  >
                    📣
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
        {others.length === 0 && <li className="muted">Belum ada anggota lain.</li>}
      </ul>
    </aside>
  );
}

/** Panggilan masuk: datang (teleport) atau nanti. */
export function SummonPrompt() {
  const summon = useNet((s) => s.summon);
  if (!summon) return null;
  const dismiss = () => useNet.setState({ summon: null });
  return (
    <div className="summon">
      <div>
        📣 <b>{summon.name}</b> memanggilmu{summon.place ? ` ke ${summon.place}` : ""}
      </div>
      <div className="row-actions">
        <button
          className="primary small"
          onClick={() => {
            const s = remoteState.get(summon.from);
            const p = s?.p ?? summon.p;
            teleportNear(p[0], p[2]);
            dismiss();
          }}
        >
          Datang
        </button>
        <button className="secondary small" onClick={dismiss}>
          Nanti
        </button>
      </div>
    </div>
  );
}
