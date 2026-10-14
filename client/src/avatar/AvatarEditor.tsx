import { useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Character } from "./Character";
import { ANIM } from "../anims";
import {
  CLOTH_COLORS,
  HAIR_COLORS,
  LABELS,
  OPTIONS,
  SKIN_TONES,
  randomAvatar,
  type AvatarConfig,
} from "./config";
import { t, useT } from "../i18n";

const PREVIEW_ANIMS = [
  { label: "Diam", anim: ANIM.idle },
  { label: "Jalan", anim: ANIM.walk },
  { label: "Lambai", anim: ANIM.wave },
  { label: "Joget", anim: ANIM.dance },
];

function Preview({ config }: { config: AvatarConfig }) {
  useT();
  const [anim, setAnim] = useState<number>(ANIM.idle);
  return (
    <div className="preview">
      <Canvas shadows="percentage" camera={{ position: [0, 1.2, 4.2], fov: 30 }} dpr={[1, 2]}>
        <color attach="background" args={["#efe6da"]} />
        <hemisphereLight args={["#ffffff", "#c9b89e", 1.1]} />
        <directionalLight position={[2, 4, 3]} intensity={2.2} castShadow />
        <Character config={config} getAnim={() => anim} />
        <ContactShadows opacity={0.35} blur={2.2} far={2} />
        <OrbitControls target={[0, 0.95, 0]} enablePan={false} enableZoom={false} minPolarAngle={1.1} maxPolarAngle={1.7} />
      </Canvas>
      <div className="preview-anims">
        {PREVIEW_ANIMS.map((a) => (
          <button key={a.label} type="button" className={anim === a.anim ? "chip active" : "chip"} onClick={() => setAnim(a.anim)}>
            {t(a.label)}
          </button>
        ))}
      </div>
      <p className="hint">{t("Geser untuk memutar")}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <div className="row-label">{t(label)}</div>
      <div className="row-body">{children}</div>
    </div>
  );
}

function Chips<T extends string>({ options, value, onChange, disabled }: { options: readonly T[]; value: T; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} type="button" disabled={disabled} className={o === value ? "chip active" : "chip"} onClick={() => onChange(o)}>
          {t(LABELS[o] ?? o)}
        </button>
      ))}
    </div>
  );
}

function Colors({ palette, value, onChange, custom = true }: { palette: string[]; value: string; onChange: (v: string) => void; custom?: boolean }) {
  return (
    <div className="colors">
      {palette.map((c) => (
        <button
          type="button"
          key={c}
          className={c.toLowerCase() === value.toLowerCase() ? "swatch active" : "swatch"}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`${t("Warna")} ${c}`}
        />
      ))}
      {custom && (
        <label className="swatch custom" title={t("Warna lain")}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
      )}
    </div>
  );
}

interface Props {
  value: AvatarConfig;
  onChange: (v: AvatarConfig) => void;
  header?: ReactNode;
  footer: ReactNode;
}

export function AvatarEditor({ value: c, onChange, header, footer }: Props) {
  useT();
  const set = <K extends keyof AvatarConfig>(key: K, v: AvatarConfig[K]) => onChange({ ...c, [key]: v });

  return (
    <div className="editor">
      <Preview config={c} />
      <div className="editor-panel">
        {header}
        <div className="editor-options">
          <Row label="Tubuh">
            <Chips options={OPTIONS.body} value={c.body} onChange={(v) => set("body", v)} />
          </Row>
          <Row label="Warna kulit">
            <Colors palette={SKIN_TONES} value={c.skin} onChange={(v) => set("skin", v)} custom={false} />
          </Row>
          <Row label="Hijab">
            <Chips options={["none", "yes"] as const} value={c.hijab ? "yes" : "none"} onChange={(v) => set("hijab", v === "yes")} />
            {c.hijab && <Colors palette={CLOTH_COLORS} value={c.hijabColor} onChange={(v) => set("hijabColor", v)} />}
          </Row>
          {!c.hijab && (
            <Row label="Rambut">
              <Chips options={OPTIONS.hair} value={c.hair} onChange={(v) => set("hair", v)} />
              <Colors palette={HAIR_COLORS} value={c.hairColor} onChange={(v) => set("hairColor", v)} />
            </Row>
          )}
          <Row label="Atasan">
            <Chips options={OPTIONS.top} value={c.top} onChange={(v) => set("top", v)} />
            <Colors palette={CLOTH_COLORS} value={c.topColor} onChange={(v) => set("topColor", v)} />
          </Row>
          <Row label="Bawahan">
            <Chips options={OPTIONS.bottom} value={c.bottom} onChange={(v) => set("bottom", v)} />
            <Colors palette={CLOTH_COLORS} value={c.bottomColor} onChange={(v) => set("bottomColor", v)} />
          </Row>
          <Row label="Sepatu">
            <Colors palette={CLOTH_COLORS} value={c.shoeColor} onChange={(v) => set("shoeColor", v)} />
          </Row>
          <Row label="Kacamata">
            <Chips options={OPTIONS.glasses} value={c.glasses} onChange={(v) => set("glasses", v)} />
          </Row>
          {!c.hijab && (
            <Row label="Topi">
              <Chips options={OPTIONS.hat} value={c.hat} onChange={(v) => set("hat", v)} />
            </Row>
          )}
        </div>
        <div className="editor-footer">
          <button type="button" className="secondary" onClick={() => onChange(randomAvatar())}>
            🎲 {t("Acak")}
          </button>
          {footer}
        </div>
      </div>
    </div>
  );
}
