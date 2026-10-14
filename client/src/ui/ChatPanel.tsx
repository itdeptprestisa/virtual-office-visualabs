import { useEffect, useRef, useState } from "react";
import { closeDm, openChatTab, sendChat, sendDm, useNet, type ChatTab } from "../net";
import { totalUnread } from "./Hud";

const time = (ts: number) => new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

function Badge({ n }: { n?: number }) {
  return n ? <span className="badge">{n > 99 ? "99+" : n}</span> : null;
}

/** Chat: Area (hanya orang yang bisa mendengarmu), Umum (semua), dan pesan pribadi (DM). */
export function ChatPanel() {
  const tab = useNet((s) => s.chatTab);
  const open = useNet((s) => s.chatOpen);
  const unread = useNet((s) => s.unread);
  const openDms = useNet((s) => s.openDms);
  const directory = useNet((s) => s.directory);
  const zone = useNet((s) => s.zone);
  const selfId = useNet((s) => s.selfId);
  const me = useNet((s) => s.me);
  const area = useNet((s) => s.chat.area);
  const umum = useNet((s) => s.chat.umum);
  const dms = useNet((s) => s.dms);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const dmWith = tab.startsWith("dm:") ? tab.slice(3) : null;
  const dmUser = dmWith ? directory.find((u) => u.id === dmWith) : null;
  const messages =
    tab === "area"
      ? area.map((m) => ({ key: `${m.ts}${m.id}`, mine: m.id === selfId, name: m.name, text: m.text, ts: m.ts, scope: m.scope }))
      : tab === "umum"
        ? umum.map((m) => ({ key: `${m.ts}${m.id}`, mine: m.id === selfId, name: m.name, text: m.text, ts: m.ts, scope: undefined }))
        : (dms[dmWith!] ?? []).map((m) => ({ key: `${m.ts}${m.from}`, mine: m.from === selfId, name: m.name, text: m.text, ts: m.ts, scope: undefined }));

  useEffect(() => {
    list.current?.scrollTo(0, list.current.scrollHeight);
  }, [messages.length, tab, open]);

  // Enter di mana saja = fokus ke kolom chat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "Enter" || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      e.preventDefault();
      if (!useNet.getState().chatOpen) openChatTab(useNet.getState().chatTab);
      setTimeout(() => input.current?.focus(), 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (body) {
      if (dmWith) sendDm(dmWith, body);
      else sendChat(tab === "umum" ? "umum" : "area", body);
    }
    setText("");
    input.current?.blur(); // kembali ke kontrol jalan (WASD) setelah kirim
  };

  const highlight = (t: string) => (me && new RegExp(`@${me.username}\\b`, "i").test(t) ? "chat-line mention" : "chat-line");

  if (!open) {
    const total = totalUnread(unread);
    return (
      <button className="chat-toggle pill clickable" onClick={() => openChatTab(tab)}>
        💬 Chat <Badge n={total} />
      </button>
    );
  }

  return (
    <div className="chat">
      <div className="chat-tabs">
        <button className={tab === "area" ? "tab active" : "tab"} onClick={() => openChatTab("area")} title="Hanya orang yang bisa mendengarmu">
          📍 {zone ?? "Sekitar"} <Badge n={unread.area} />
        </button>
        <button className={tab === "umum" ? "tab active" : "tab"} onClick={() => openChatTab("umum")} title="Semua orang">
          🌐 Umum <Badge n={unread.umum} />
        </button>
        {openDms.map((id) => {
          const u = directory.find((d) => d.id === id);
          const t: ChatTab = `dm:${id}`;
          return (
            <span key={id} className={tab === t ? "tab active dm" : "tab dm"}>
              <button onClick={() => openChatTab(t)}>
                {u?.online ? "🟢" : "⚪"} {u?.name ?? "?"} <Badge n={unread[t]} />
              </button>
              <button className="x" onClick={() => closeDm(id)} aria-label="Tutup percakapan">
                ×
              </button>
            </span>
          );
        })}
        <button className="tab collapse" onClick={() => useNet.setState({ chatOpen: false })} aria-label="Sembunyikan chat">
          ▾
        </button>
      </div>
      <div className="chat-list" ref={list}>
        {messages.length === 0 && (
          <div className="chat-empty">
            {tab === "area"
              ? zone
                ? `Pesan di sini hanya terbaca orang di ${zone}.`
                : "Pesan di sini hanya terbaca orang di dekatmu (radius 4 m)."
              : tab === "umum"
                ? "Pesan untuk semua orang di kantor."
                : `Percakapan pribadi dengan ${dmUser?.name ?? "?"}.`}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.key} className={`${highlight(m.text)}${m.mine ? " mine" : ""}`}>
            <b>{m.mine ? "Kamu" : m.name}</b>
            {m.scope && tab === "area" && <span className="scope"> · {m.scope}</span>}
            <span className="time"> {time(m.ts)}</span>
            <div>{m.text}</div>
          </div>
        ))}
      </div>
      <form onSubmit={submit}>
        <input
          ref={input}
          value={text}
          maxLength={dmWith ? 1000 : 500}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && input.current?.blur()}
          placeholder={dmWith ? `Pesan ke ${dmUser?.name ?? "?"}…` : tab === "umum" ? "Pesan ke semua orang… (@username untuk menyebut)" : "Pesan ke orang di sekitar…"}
        />
      </form>
    </div>
  );
}
