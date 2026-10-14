import { useEffect } from "react";
import { ITEM_LABELS, ITEM_TYPES, type Area, type Room, type Side } from "../../../shared/layout";
import {
  addArea,
  addFloor,
  addItem,
  addRoom,
  deleteArea,
  deleteFloor,
  deleteItem,
  deleteRoom,
  renameFloor,
  rotateItem,
  updateArea,
  updateRoom,
  useEditor,
} from "../editor";
import { changeFloor, selfPos, useNet } from "../net";
import { place, t, useT } from "../i18n";

const here = (): [number, number] => {
  const p = selfPos.p;
  return p ? [p[0], p[2] - 1.5] : [0, 6];
};

function Num({ value, onChange, step = 0.25 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return <input type="number" step={step} value={Math.round(value * 100) / 100} onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))} />;
}

function RoomEditor({ room }: { room: Room }) {
  useT();
  const set = (patch: Partial<Room>) => updateRoom(room.id, patch);
  return (
    <details className="ed-block">
      <summary>
        <span className="dot" style={{ background: room.color }} /> {place(room.name)}
      </summary>
      <label>
        {t("Nama")} <input value={room.name} maxLength={40} onChange={(e) => set({ name: e.target.value || room.name })} />
      </label>
      <div className="ed-grid">
        <span>{t("x dari")}</span>
        <Num value={room.x[0]} onChange={(v) => set({ x: [v, room.x[1]] })} />
        <span>{t("sampai")}</span>
        <Num value={room.x[1]} onChange={(v) => set({ x: [room.x[0], v] })} />
        <span>{t("z dari")}</span>
        <Num value={room.z[0]} onChange={(v) => set({ z: [v, room.z[1]] })} />
        <span>{t("sampai")}</span>
        <Num value={room.z[1]} onChange={(v) => set({ z: [room.z[0], v] })} />
        <span>{t("Pintu")}</span>
        <select value={room.door.side} onChange={(e) => set({ door: { ...room.door, side: e.target.value as Side } })}>
          <option value="n">{t("Utara")}</option>
          <option value="s">{t("Selatan")}</option>
          <option value="w">{t("Barat")}</option>
          <option value="e">{t("Timur")}</option>
        </select>
        <span>{t("tengah")}</span>
        <Num value={room.door.center} onChange={(v) => set({ door: { ...room.door, center: v } })} />
        <span>{t("lebar")}</span>
        <Num value={room.door.width} onChange={(v) => set({ door: { ...room.door, width: v } })} />
        <span>{t("warna")}</span>
        <input type="color" value={room.color} onChange={(e) => set({ color: e.target.value })} />
      </div>
      <button className="link" onClick={() => confirm(t("Hapus {name}?", { name: place(room.name) })) && deleteRoom(room.id)}>
        {t("Hapus ruangan")}
      </button>
    </details>
  );
}

function AreaEditor({ area }: { area: Area }) {
  useT();
  const set = (patch: Partial<Area>) => updateArea(area.id, patch);
  return (
    <details className="ed-block">
      <summary>
        <span className="dot" style={{ background: area.color }} /> {place(area.name)}
        {area.stage && <span className="tag">{t("panggung")}</span>}
      </summary>
      <label>
        {t("Nama")} <input value={area.name} maxLength={40} onChange={(e) => set({ name: e.target.value || area.name })} />
      </label>
      <div className="ed-grid">
        {area.shape === "circle" ? (
          <>
            <span>{t("pusat x")}</span>
            <Num value={area.cx} onChange={(v) => set({ cx: v })} />
            <span>{t("pusat z")}</span>
            <Num value={area.cz} onChange={(v) => set({ cz: v })} />
            <span>{t("jari-jari")}</span>
            <Num value={area.r} onChange={(v) => set({ r: v })} />
          </>
        ) : (
          <>
            <span>{t("x dari")}</span>
            <Num value={area.x[0]} onChange={(v) => set({ x: [v, area.x[1]] })} />
            <span>{t("sampai")}</span>
            <Num value={area.x[1]} onChange={(v) => set({ x: [area.x[0], v] })} />
            <span>{t("z dari")}</span>
            <Num value={area.z[0]} onChange={(v) => set({ z: [v, area.z[1]] })} />
            <span>{t("sampai")}</span>
            <Num value={area.z[1]} onChange={(v) => set({ z: [area.z[0], v] })} />
          </>
        )}
        <span>{t("warna")}</span>
        <input type="color" value={area.color} onChange={(e) => set({ color: e.target.value })} />
      </div>
      <label className="setting-row">
        <span>{t("Panggung (terdengar satu lantai)")}</span>
        <input type="checkbox" checked={!!area.stage} onChange={(e) => set({ stage: e.target.checked || undefined })} />
      </label>
      <button className="link" onClick={() => confirm(t("Hapus {name}?", { name: place(area.name) })) && deleteArea(area.id)}>
        {t("Hapus area")}
      </button>
    </details>
  );
}

/** Panel editor denah (admin). Klik furnitur di dunia untuk memilih, seret untuk memindah. */
export function EditorPanel() {
  useT();
  const active = useEditor((s) => s.active);
  const selected = useEditor((s) => s.selected);
  const layout = useNet((s) => s.layout);
  const floorId = useNet((s) => s.floor);
  const floor = layout?.floors.find((f) => f.id === floorId);
  const derivedAll = useNet((s) => s.derivedAll);
  const item = floor?.items.find((i) => i.id === selected);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") return;
      const sel = useEditor.getState().selected;
      if (!sel) return;
      if (e.code === "KeyR") rotateItem(sel);
      if (e.code === "Delete" || e.code === "Backspace") deleteItem(sel);
      if (e.code === "Escape") useEditor.setState({ selected: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  if (!active || !layout || !floor) return null;
  return (
    <aside className="editor-panel-float">
      <div className="side-head">
        <b>✏️ {t("Edit denah")}</b>
        <button className="x" onClick={() => useEditor.setState({ active: false, selected: null })} aria-label={t("Selesai")}>
          ×
        </button>
      </div>
      <p className="muted small">{t("Klik furnitur untuk memilih, seret untuk memindah. Perubahan langsung tersimpan & terlihat semua orang.")}</p>

      <section>
        <h4>
          {t("Lantai")} <button className="link" onClick={addFloor}>+ {t("tambah")}</button>
        </h4>
        <div className="chips">
          {layout.floors.map((f) => (
            <button
              key={f.id}
              className={f.id === floorId ? "chip active" : "chip"}
              onClick={() => {
                if (f.id === floorId) return;
                const exit = derivedAll[f.id]?.elevators[0]?.exit ?? [0, 8];
                changeFloor(f.id, [exit[0], 0, exit[1]]);
                import("../Player").then((m) => m.teleportTo(exit[0], exit[1]));
                useEditor.setState({ selected: null });
              }}
            >
              {place(f.name)}
            </button>
          ))}
        </div>
        <div className="row-actions">
          <input className="ed-input" value={floor.name} maxLength={40} onChange={(e) => renameFloor(floor.id, e.target.value)} aria-label={t("Nama lantai")} />
          {layout.floors.length > 1 && (
            <button className="link" onClick={() => confirm(t("Hapus {name} beserta isinya?", { name: place(floor.name) })) && deleteFloor(floor.id)}>
              {t("Hapus lantai")}
            </button>
          )}
        </div>
      </section>

      {item ? (
        <section className="ed-selected">
          <b>{t(ITEM_LABELS[item.type])}</b>
          <span className="muted small">
            ({item.x}, {item.z})
          </span>
          <div className="row-actions">
            <button className="secondary small" onClick={() => rotateItem(item.id)}>
              ⟳ {t("Putar")} (R)
            </button>
            <button className="secondary small danger-text" onClick={() => deleteItem(item.id)}>
              {t("Hapus")} (Del)
            </button>
          </div>
        </section>
      ) : (
        <p className="muted small">{t("Belum ada furnitur dipilih.")}</p>
      )}

      <section>
        <h4>{t("Tambah furnitur di dekatmu")}</h4>
        <div className="chips">
          {ITEM_TYPES.map((type) => (
            <button key={type} className="chip" onClick={() => addItem(type, ...here())}>
              {t(ITEM_LABELS[type])}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h4>
          {t("Ruangan")} <button className="link" onClick={() => addRoom(...here())}>+ {t("tambah")}</button>
        </h4>
        {floor.rooms.map((r) => (
          <RoomEditor key={r.id} room={r} />
        ))}
      </section>

      <section>
        <h4>
          {t("Area terbuka")}
          <span>
            <button className="link" onClick={() => addArea(...here())}>+ {t("area")}</button>{" "}
            <button className="link" onClick={() => addArea(...here(), true)}>+ {t("panggung")}</button>
          </span>
        </h4>
        {floor.areas.map((a) => (
          <AreaEditor key={a.id} area={a} />
        ))}
      </section>
    </aside>
  );
}
