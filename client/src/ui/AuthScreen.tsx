import { useState } from "react";
import { AvatarEditor } from "../avatar/AvatarEditor";
import { randomAvatar } from "../avatar/config";
import { enter, joinAsGuest, login, register, useNet } from "../net";
import { setLang, useLang, useT } from "../i18n";

/** Pilihan bahasa (ID/EN). */
export function LangSwitch() {
  const lang = useLang((s) => s.lang);
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {(["id", "en"] as const).map((l) => (
        <button key={l} type="button" className={l === lang ? "active" : ""} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Masuk lewat link tamu: cukup isi nama. */
export function GuestScreen() {
  const t = useT();
  const authError = useNet((s) => s.authError);
  const [name, setName] = useState("");
  return (
    <div className="overlay">
      <form
        className="card auth"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) joinAsGuest(name.trim());
        }}
      >
        <div className="auth-head">
          <h1>Virtual Office</h1>
          <LangSwitch />
        </div>
        <p className="muted">{t("Kamu diundang sebagai tamu. Isi nama yang akan dilihat orang lain.")}</p>
        <label>
          {t("Nama")}
          <input autoFocus value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder={t("mis. Rudi (PT Maju)")} />
        </label>
        {authError && <p className="error">{t(authError)}</p>}
        <button className="primary" disabled={!name.trim()}>
          {t("Masuk sebagai tamu")}
        </button>
      </form>
    </div>
  );
}

/** Masuk / daftar akun. Pendaftar pertama otomatis menjadi admin. */
export function AuthScreen() {
  const t = useT();
  const authError = useNet((s) => s.authError);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => setBusy(false), 1500);
    if (mode === "login") login(username.trim(), password);
    else register(username.trim(), password, name.trim(), invite.trim());
  };

  return (
    <div className="overlay">
      <form className="card auth" onSubmit={submit}>
        <div className="auth-head">
          <h1>Virtual Office</h1>
          <LangSwitch />
        </div>
        <div className="tabs">
          <button type="button" className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")}>
            {t("Masuk")}
          </button>
          <button type="button" className={mode === "register" ? "tab active" : "tab"} onClick={() => setMode("register")}>
            {t("Daftar")}
          </button>
        </div>
        <label>
          Username
          <input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder={t("mis. budi.s")} />
        </label>
        {mode === "register" && (
          <label>
            {t("Nama tampilan")}
            <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder={t("Nama yang terlihat orang lain")} />
          </label>
        )}
        <label>
          Password
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "register" ? t("Minimal 6 karakter") : ""}
          />
        </label>
        {mode === "register" && (
          <label>
            {t("Kode undangan")} <span className="muted">{t("(bila diminta admin)")}</span>
            <input value={invite} onChange={(e) => setInvite(e.target.value)} />
          </label>
        )}
        {authError && <p className="error">{t(authError)}</p>}
        <button className="primary" disabled={busy || !username || !password || (mode === "register" && !name.trim())}>
          {mode === "login" ? t("Masuk") : t("Buat akun")}
        </button>
        {mode === "register" && <p className="muted small">{t("Akun pertama yang dibuat otomatis menjadi admin.")}</p>}
      </form>
    </div>
  );
}

/** Langkah pertama setelah daftar: buat avatar. */
export function FirstAvatarScreen() {
  const t = useT();
  const me = useNet((s) => s.me);
  const [avatar, setAvatar] = useState(randomAvatar);
  return (
    <div className="overlay">
      <AvatarEditor
        value={avatar}
        onChange={setAvatar}
        header={
          <div className="editor-header">
            <h1>{t("Halo, {name}! 👋", { name: me?.name ?? "" })}</h1>
            <p className="muted">{t("Buat avatarmu dulu. Bisa diubah lagi kapan saja.")}</p>
          </div>
        }
        footer={
          <button type="button" className="primary" onClick={() => enter(avatar)}>
            {t("Masuk ke kantor")}
          </button>
        }
      />
    </div>
  );
}

export function KickedScreen() {
  const t = useT();
  const reason = useNet((s) => s.kickedReason);
  return (
    <div className="overlay">
      <div className="card">
        <h2>{t("Sesi berakhir")}</h2>
        <p>{reason && t(reason)}</p>
        <button className="primary" onClick={() => location.reload()}>
          {t("Masuk lagi")}
        </button>
      </div>
    </div>
  );
}
