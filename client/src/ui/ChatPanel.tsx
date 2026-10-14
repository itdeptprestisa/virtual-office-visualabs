import { useEffect, useRef, useState } from "react";
import {
  closeDm,
  fileUrl,
  openChatTab,
  sendChat,
  sendDm,
  sendReaction,
  sendSearch,
  showNotice,
  uploadFile,
  useNet,
  type ChatTab,
  type FileRef,
  type Reactions,
} from "../net";
import { totalUnread } from "./Hud";
import { locale, place, t, useT } from "../i18n";

const EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🙏"];
const time = (ts: number) => new Date(ts).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
const size = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

function Badge({ n }: { n?: number }) {
  return n ? <span className="badge">{n > 99 ? "99+" : n}</span> : null;
}

function Attachment({ file }: { file: FileRef }) {
  const url = fileUrl(file);
  if (file.mime.startsWith("image/") && file.mime !== "image/svg+xml") {
    return (
      <a href={url} target="_blank" rel="noreferrer noopener" className="chat-image">
        <img src={url} alt={file.name} loading="lazy" />
      </a>
    );
  }
  return (
    <a href={url} className="chat-file" download={file.name}>
      📎 {file.name} <span className="muted">({size(file.size)})</span>
    </a>
  );
}

function ReactionBar({ reactions, selfId, onReact }: { reactions?: Reactions; selfId: string | null; onReact?: (e: string) => void }) {
  const [picking, setPicking] = useState(false);
  if (!onReact) return null;
  const entries = Object.entries(reactions ?? {});
  return (
    <div className="reactions">
      {entries.map(([emoji, users]) => (
        <button key={emoji} className={selfId && users.includes(selfId) ? "react mine" : "react"} onClick={() => onReact(emoji)}>
          {emoji} {users.length}
        </button>
      ))}
      {picking ? (
        EMOJIS.map((e) => (
          <button
            key={e}
            className="react pick"
            onClick={() => {
              onReact(e);
              setPicking(false);
            }}
          >
            {e}
          </button>
        ))
      ) : (
        <button className="react add" onClick={() => setPicking(true)} title={t("Beri reaksi")}>
          ☺︎+
        </button>
      )}
    </div>
  );
}

/** Pencarian pesan (Umum + DM milik sendiri). */
function SearchView({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const search = useNet((s) => s.search);
  const directory = useNet((s) => s.directory);
  useEffect(() => {
    const t = setTimeout(() => sendSearch(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const results = search && search.q === q.trim().toLowerCase() ? search.results : [];
  return (
    <div className="chat-search">
      <div className="row-actions">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Cari pesan atau nama file…")} onKeyDown={(e) => e.key === "Escape" && onClose()} />
        <button className="secondary small" onClick={onClose}>
          {t("Tutup")}
        </button>
      </div>
      <div className="chat-list">
        {q.trim().length >= 2 && results.length === 0 && <div className="chat-empty">{t("Tidak ada hasil.")}</div>}
        {results.map((r) => (
          <button
            key={r.id}
            className="chat-line result"
            onClick={() => {
              openChatTab(r.channel === "umum" ? "umum" : `dm:${r.with}`);
              onClose();
            }}
          >
            <b>{r.name}</b>
            <span className="scope"> · {r.channel === "umum" ? t("Umum") : `DM ${directory.find((u) => u.id === r.with)?.name ?? ""}`}</span>
            <span className="time"> {new Date(r.ts).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            <div>{r.text || (r.file ? `📎 ${r.file.name}` : "")}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Chat: Area (hanya orang yang bisa mendengarmu), Umum (semua), pesan pribadi (DM), lampiran, reaksi, pencarian. */
export function ChatPanel() {
  const t = useT();
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
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const dmWith = tab.startsWith("dm:") ? tab.slice(3) : null;
  const dmUser = dmWith ? directory.find((u) => u.id === dmWith) : null;
  const messages =
    tab === "area"
      ? area.map((m) => ({ key: m.mid ?? `${m.ts}${m.id}`, mid: undefined as string | undefined, mine: m.id === selfId, name: m.name, text: m.text, ts: m.ts, scope: m.scope, file: m.file, reactions: undefined as Reactions | undefined }))
      : tab === "umum"
        ? umum.map((m) => ({ key: m.mid, mid: m.mid as string | undefined, mine: m.id === selfId, name: m.name, text: m.text, ts: m.ts, scope: undefined, file: m.file, reactions: m.reactions }))
        : (dms[dmWith!] ?? []).map((m) => ({ key: m.id, mid: m.id as string | undefined, mine: m.from === selfId, name: m.name, text: m.text, ts: m.ts, scope: undefined, file: m.file, reactions: m.reactions }));

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

  const deliver = (body: string, file?: FileRef) => {
    if (dmWith) sendDm(dmWith, body, file);
    else sendChat(tab === "umum" ? "umum" : "area", body, file);
  };

  const attach = async (file: File) => {
    setUploading(true);
    try {
      const ref = await uploadFile(file);
      deliver(text.trim(), ref);
      setText("");
    } catch (err) {
      showNotice(`📎 ${t((err as Error).message)}`);
    } finally {
      setUploading(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (body) deliver(body);
    setText("");
    input.current?.blur(); // kembali ke kontrol jalan (WASD) setelah kirim
  };

  // Reaksi hanya untuk pesan yang tersimpan (Umum & DM); chat area sifatnya sesaat.
  const react = (mid?: string) =>
    !mid ? undefined : tab === "umum" ? (e: string) => sendReaction("umum", mid, e) : dmWith ? (e: string) => sendReaction("dm", mid, e, dmWith) : undefined;

  const highlight = (t: string) => (me && new RegExp(`@${me.username.replace(/\./g, "\\.")}\\b`, "i").test(t) ? "chat-line mention" : "chat-line");

  if (!open) {
    return (
      <button className="chat-toggle pill clickable" onClick={() => openChatTab(tab)}>
        💬 {t("Chat")} <Badge n={totalUnread(unread)} />
      </button>
    );
  }

  return (
    <div
      className={dragOver ? "chat drag" : "chat"}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) attach(f);
      }}
    >
      <div className="chat-tabs">
        <button className={tab === "area" ? "tab active" : "tab"} onClick={() => openChatTab("area")} title={t("Hanya orang yang bisa mendengarmu")}>
          📍 {zone ? place(zone) : t("Sekitar")} <Badge n={unread.area} />
        </button>
        <button className={tab === "umum" ? "tab active" : "tab"} onClick={() => openChatTab("umum")} title={t("Semua orang")}>
          🌐 {t("Umum")} <Badge n={unread.umum} />
        </button>
        {openDms.map((id) => {
          const u = directory.find((d) => d.id === id);
          const dmTab: ChatTab = `dm:${id}`;
          return (
            <span key={id} className={tab === dmTab ? "tab active dm" : "tab dm"}>
              <button onClick={() => openChatTab(dmTab)}>
                {u?.online ? "🟢" : "⚪"} {u?.name ?? "?"} <Badge n={unread[dmTab]} />
              </button>
              <button className="x" onClick={() => closeDm(id)} aria-label={t("Tutup percakapan")}>
                ×
              </button>
            </span>
          );
        })}
        <button className={searching ? "tab active" : "tab"} onClick={() => setSearching(!searching)} title={t("Cari pesan")} aria-label={t("Cari pesan")}>
          🔍
        </button>
        <button className="tab collapse" onClick={() => useNet.setState({ chatOpen: false })} aria-label={t("Sembunyikan chat")}>
          ▾
        </button>
      </div>
      {searching ? (
        <SearchView onClose={() => setSearching(false)} />
      ) : (
        <>
          <div className="chat-list" ref={list}>
            {messages.length === 0 && (
              <div className="chat-empty">
                {tab === "area"
                  ? zone
                    ? t("Pesan di sini hanya terbaca orang di {place}.", { place: place(zone) })
                    : t("Pesan di sini hanya terbaca orang di dekatmu (radius 4 m).")
                  : tab === "umum"
                    ? t("Pesan untuk semua orang di kantor.")
                    : t("Percakapan pribadi dengan {name}.", { name: dmUser?.name ?? "?" })}
              </div>
            )}
            {messages.map((m) => (
              <div key={m.key} className={`${highlight(m.text)}${m.mine ? " mine" : ""}`}>
                <b>{m.mine ? t("Kamu") : m.name}</b>
                {m.scope && tab === "area" && <span className="scope"> · {place(m.scope)}</span>}
                <span className="time"> {time(m.ts)}</span>
                {m.text && <div>{m.text}</div>}
                {m.file && <Attachment file={m.file} />}
                <ReactionBar reactions={m.reactions} selfId={selfId} onReact={react(m.mid)} />
              </div>
            ))}
            {dragOver && <div className="chat-empty">{t("Lepaskan untuk mengirim file (maks 5 MB)")}</div>}
          </div>
          <form onSubmit={submit} className="chat-form">
            <button type="button" className="attach" onClick={() => fileInput.current?.click()} disabled={uploading} title={t("Kirim file (maks 5 MB)")}>
              {uploading ? "⏳" : "📎"}
            </button>
            <input
              ref={fileInput}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) attach(f);
                e.target.value = "";
              }}
            />
            <input
              ref={input}
              value={text}
              maxLength={dmWith ? 1000 : 500}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && input.current?.blur()}
              onPaste={(e) => {
                const f = [...e.clipboardData.files][0];
                if (f) {
                  e.preventDefault();
                  attach(f);
                }
              }}
              placeholder={
                dmWith
                  ? t("Pesan ke {name}…", { name: dmUser?.name ?? "?" })
                  : tab === "umum"
                    ? t("Pesan ke semua orang… (@username untuk menyebut)")
                    : t("Pesan ke orang di sekitar…")
              }
            />
          </form>
        </>
      )}
    </div>
  );
}
