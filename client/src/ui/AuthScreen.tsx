import { useState } from "react";
import { AvatarEditor } from "../avatar/AvatarEditor";
import { randomAvatar } from "../avatar/config";
import { enter, login, register, useNet } from "../net";

/** Masuk / daftar akun. Pendaftar pertama otomatis menjadi admin. */
export function AuthScreen() {
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
        <h1>Virtual Office</h1>
        <div className="tabs">
          <button type="button" className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")}>
            Masuk
          </button>
          <button type="button" className={mode === "register" ? "tab active" : "tab"} onClick={() => setMode("register")}>
            Daftar
          </button>
        </div>
        <label>
          Username
          <input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="mis. budi.s" />
        </label>
        {mode === "register" && (
          <label>
            Nama tampilan
            <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Nama yang terlihat orang lain" />
          </label>
        )}
        <label>
          Password
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "register" ? "Minimal 6 karakter" : ""}
          />
        </label>
        {mode === "register" && (
          <label>
            Kode undangan <span className="muted">(bila diminta admin)</span>
            <input value={invite} onChange={(e) => setInvite(e.target.value)} />
          </label>
        )}
        {authError && <p className="error">{authError}</p>}
        <button className="primary" disabled={busy || !username || !password || (mode === "register" && !name.trim())}>
          {mode === "login" ? "Masuk" : "Buat akun"}
        </button>
        {mode === "register" && <p className="muted small">Akun pertama yang dibuat otomatis menjadi admin.</p>}
      </form>
    </div>
  );
}

/** Langkah pertama setelah daftar: buat avatar. */
export function FirstAvatarScreen() {
  const me = useNet((s) => s.me);
  const [avatar, setAvatar] = useState(randomAvatar);
  return (
    <div className="overlay">
      <AvatarEditor
        value={avatar}
        onChange={setAvatar}
        header={
          <div className="editor-header">
            <h1>Halo, {me?.name}! 👋</h1>
            <p className="muted">Buat avatarmu dulu. Bisa diubah lagi kapan saja.</p>
          </div>
        }
        footer={
          <button type="button" className="primary" onClick={() => enter(avatar)}>
            Masuk ke kantor
          </button>
        }
      />
    </div>
  );
}

export function KickedScreen() {
  const reason = useNet((s) => s.kickedReason);
  return (
    <div className="overlay">
      <div className="card">
        <h2>Sesi berakhir</h2>
        <p>{reason}</p>
        <button className="primary" onClick={() => location.reload()}>
          Masuk lagi
        </button>
      </div>
    </div>
  );
}
