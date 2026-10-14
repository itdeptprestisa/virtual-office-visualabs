import { openChatTab, remoteState, sendStatus, sendSummon, showNotice, useNet, type DirUser, type Presence } from "../net";
import { teleportNear } from "../Player";
import { place, t, useT } from "../i18n";

export const STATUS: Record<Presence, { label: string; color: string }> = {
  available: { label: "Tersedia", color: "#3fb26b" },
  busy: { label: "Sibuk", color: "#e5484d" },
  focus: { label: "Fokus", color: "#e8743b" },
  meeting: { label: "Rapat", color: "#8b5cf6" },
  away: { label: "Away", color: "#e0a930" },
  offline: { label: "Offline", color: "#b7b2aa" },
};

export function StatusDot({ status }: { status: Presence }) {
  return <span className="dot" style={{ background: STATUS[status].color }} title={t(STATUS[status].label)} />;
}

function locate(u: DirUser) {
  const s = remoteState.get(u.id);
  if (!s) return;
  teleportNear(s.p[0], s.p[2], u.floor ?? undefined);
  showNotice(`📍 ${t("Pindah ke dekat {name}", { name: u.name })}${u.zone ? ` (${place(u.zone)})` : ""}${u.floorName ? ` · ${place(u.floorName)}` : ""}`);
}

/** Daftar anggota: status, lokasi, angkat tangan; DM / cari / panggil. */
export function MemberPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const users = useNet((s) => s.directory);
  const selfId = useNet((s) => s.selfId);
  const manual = useNet((s) => s.manualStatus);
  const me = users.find((u) => u.id === selfId);
  const others = users
    .filter((u) => u.id !== selfId)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  const online = others.filter((u) => u.online).length;
  const multiFloor = useNet((s) => (s.layout?.floors.length ?? 1) > 1);
  const following = useNet((s) => s.following);

  return (
    <aside className="side-panel">
      <div className="side-head">
        <b>👥 {t("Anggota")}</b>
        <span className="muted small">
          {t("{n} online · {m} terdaftar", { n: online + 1, m: users.length })}
        </span>
        <button className="x" onClick={onClose} aria-label={t("Tutup")}>
          ×
        </button>
      </div>
      {me && (
        <div className="me-status">
          <StatusDot status={me.status} />
          <span>
            {t("Statusmu")}: <b>{t(STATUS[me.status].label)}</b>
            {me.calendar && <span className="muted small"> · {t("dari kalender")}</span>}
          </span>
          <select value={manual} onChange={(e) => sendStatus({ manual: e.target.value as "available" | "busy" | "away" })} aria-label={t("Atur status")}>
            <option value="available">{t("Otomatis")}</option>
            <option value="busy">{t("Sibuk (jangan diganggu)")}</option>
            <option value="away">{t("Away")}</option>
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
                {u.role === "guest" && <span className="tag">{t("tamu")}</span>}
              </div>
              <div className="muted small">
                {t(STATUS[u.status].label)}
                {u.calendar && ` (${t("kalender")})`}
                {u.online && u.zone && ` · ${place(u.zone)}`}
                {u.online && u.floorName && multiFloor && ` · ${place(u.floorName)}`}
              </div>
            </div>
            <div className="actions">
              <button title={t("Kirim pesan")} onClick={() => openChatTab(`dm:${u.id}`)}>
                💬
              </button>
              {u.online && (
                <>
                  <button title={t("Pergi ke dekatnya")} onClick={() => locate(u)}>
                    📍
                  </button>
                  <button
                    title={following === u.id ? t("Berhenti mengikuti") : t("Ikuti (jalan otomatis di belakangnya)")}
                    className={following === u.id ? "on" : ""}
                    onClick={() => {
                      useNet.setState({ following: following === u.id ? null : u.id });
                      if (following !== u.id) showNotice(`👣 ${t("Mengikuti {name} — tekan tombol gerak untuk berhenti", { name: u.name })}`);
                    }}
                  >
                    👣
                  </button>
                  <button
                    title={t("Panggil ke tempatku")}
                    onClick={() => {
                      sendSummon(u.id);
                      showNotice(`📣 ${t("{name} dipanggil ke tempatmu", { name: u.name })}`);
                    }}
                  >
                    📣
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
        {others.length === 0 && <li className="muted">{t("Belum ada anggota lain.")}</li>}
      </ul>
    </aside>
  );
}

/** Panggilan masuk: datang (teleport) atau nanti. */
export function SummonPrompt() {
  const t = useT();
  const summon = useNet((s) => s.summon);
  if (!summon) return null;
  const dismiss = () => useNet.setState({ summon: null });
  return (
    <div className="summon">
      <div>
        📣 <b>{summon.name}</b> {summon.place ? t("memanggilmu ke {place}", { place: place(summon.place) }) : t("memanggilmu")}
        {summon.floor !== useNet.getState().floor && ` (${place(summon.floorName)})`}
      </div>
      <div className="row-actions">
        <button
          className="primary small"
          onClick={() => {
            const s = remoteState.get(summon.from);
            const p = s?.p ?? summon.p;
            const floor = useNet.getState().players[summon.from]?.floor ?? summon.floor;
            teleportNear(p[0], p[2], floor);
            dismiss();
          }}
        >
          {t("Datang")}
        </button>
        <button className="secondary small" onClick={dismiss}>
          {t("Nanti")}
        </button>
      </div>
    </div>
  );
}
