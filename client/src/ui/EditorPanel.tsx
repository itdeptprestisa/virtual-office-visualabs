import { useEffect } from "react";
import { ITEM_LABELS, ITEM_TYPES, type Area, type Room, type Side } from "../../../shared/layout";
import { addArea, addItem, addRoom, deleteArea, deleteItem, deleteRoom, rotateItem, updateArea, updateRoom, useEditor } from "../editor";
import { selfPos, useNet } from "../net";

const here = (): [number, number] => {
  const p = selfPos.p;
  return p ? [p[0], p[2] - 1.5] : [0, 6];
};

function Num({ value, onChange, step = 0.25 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return <input type="number" step={step} value={Math.round(value * 100) / 100} onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))} />;
}

function RoomEditor({ room }: { room: Room }) {
  const set = (patch: Partial<Room>) => updateRoom(room.id, patch);
  return (
    <details className="ed-block">
      <summary>
        <span className="dot" style={{ background: room.color }} /> {room.name}
      </summary>
      <label>
        Nama <input value={room.name} maxLength={40} onChange={(e) => set({ name: e.target.value || room.name })} />
      </label>
      <div className="ed-grid">
        <span>x dari</span>
        <Num value={room.x[0]} onChange={(v) => set({ x: [v, room.x[1]] })} />
        <span>sampai</span>
        <Num value={room.x[1]} onChange={(v) => set({ x: [room.x[0], v] })} />
        <span>z dari</span>
        <Num value={room.z[0]} onChange={(v) => set({ z: [v, room.z[1]] })} />
        <span>sampai</span>
        <Num value={room.z[1]} onChange={(v) => set({ z: [room.z[0], v] })} />
        <span>Pintu</span>
        <select value={room.door.side} onChange={(e) => set({ door: { ...room.door, side: e.target.value as Side } })}>
          <option value="n">Utara</option>
          <option value="s">Selatan</option>
          <option value="w">Barat</option>
          <option value="e">Timur</option>
        </select>
        <span>tengah</span>
        <Num value={room.door.center} onChange={(v) => set({ door: { ...room.door, center: v } })} />
        <span>lebar</span>
        <Num value={room.door.width} onChange={(v) => set({ door: { ...room.door, width: v } })} />
        <span>warna</span>
        <input type="color" value={room.color} onChange={(e) => set({ color: e.target.value })} />
      </div>
      <button className="link" onClick={() => confirm(`Hapus ${room.name}?`) && deleteRoom(room.id)}>
        Hapus ruangan
      </button>
    </details>
  );
}

function AreaEditor({ area }: { area: Area }) {
  const set = (patch: Partial<Area>) => updateArea(area.id, patch);
  return (
    <details className="ed-block">
      <summary>
        <span className="dot" style={{ background: area.color }} /> {area.name}
      </summary>
      <label>
        Nama <input value={area.name} maxLength={40} onChange={(e) => set({ name: e.target.value || area.name })} />
      </label>
      <div className="ed-grid">
        {area.shape === "circle" ? (
          <>
            <span>pusat x</span>
            <Num value={area.cx} onChange={(v) => set({ cx: v })} />
            <span>pusat z</span>
            <Num value={area.cz} onChange={(v) => set({ cz: v })} />
            <span>jari-jari</span>
            <Num value={area.r} onChange={(v) => set({ r: v })} />
          </>
        ) : (
          <>
            <span>x dari</span>
            <Num value={area.x[0]} onChange={(v) => set({ x: [v, area.x[1]] })} />
            <span>sampai</span>
            <Num value={area.x[1]} onChange={(v) => set({ x: [area.x[0], v] })} />
            <span>z dari</span>
            <Num value={area.z[0]} onChange={(v) => set({ z: [v, area.z[1]] })} />
            <span>sampai</span>
            <Num value={area.z[1]} onChange={(v) => set({ z: [area.z[0], v] })} />
          </>
        )}
        <span>warna</span>
        <input type="color" value={area.color} onChange={(e) => set({ color: e.target.value })} />
      </div>
      <button className="link" onClick={() => confirm(`Hapus ${area.name}?`) && deleteArea(area.id)}>
        Hapus area
      </button>
    </details>
  );
}

/** Panel editor denah (admin). Klik furnitur di dunia untuk memilih, seret untuk memindah. */
export function EditorPanel() {
  const active = useEditor((s) => s.active);
  const selected = useEditor((s) => s.selected);
  const layout = useNet((s) => s.layout);
  const item = layout?.items.find((i) => i.id === selected);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA") return;
      const sel = useEditor.getState().selected;
      if (!sel) return;
      if (e.code === "KeyR") rotateItem(sel);
      if (e.code === "Delete" || e.code === "Backspace") deleteItem(sel);
      if (e.code === "Escape") useEditor.setState({ selected: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  if (!active || !layout) return null;
  return (
    <aside className="editor-panel-float">
      <div className="side-head">
        <b>✏️ Edit denah</b>
        <button className="x" onClick={() => useEditor.setState({ active: false, selected: null })} aria-label="Selesai">
          ×
        </button>
      </div>
      <p className="muted small">Klik furnitur untuk memilih, seret untuk memindah. Perubahan langsung tersimpan & terlihat semua orang.</p>

      {item ? (
        <section className="ed-selected">
          <b>{ITEM_LABELS[item.type]}</b>
          <span className="muted small">
            ({item.x}, {item.z})
          </span>
          <div className="row-actions">
            <button className="secondary small" onClick={() => rotateItem(item.id)}>
              ⟳ Putar (R)
            </button>
            <button className="secondary small danger-text" onClick={() => deleteItem(item.id)}>
              Hapus (Del)
            </button>
          </div>
        </section>
      ) : (
        <p className="muted small">Belum ada furnitur dipilih.</p>
      )}

      <section>
        <h4>Tambah furnitur di dekatmu</h4>
        <div className="chips">
          {ITEM_TYPES.map((t) => (
            <button key={t} className="chip" onClick={() => addItem(t, ...here())}>
              {ITEM_LABELS[t]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h4>
          Ruangan <button className="link" onClick={() => addRoom(...here())}>+ tambah</button>
        </h4>
        {layout.rooms.map((r) => (
          <RoomEditor key={r.id} room={r} />
        ))}
      </section>

      <section>
        <h4>
          Area terbuka <button className="link" onClick={() => addArea(...here())}>+ tambah</button>
        </h4>
        {layout.areas.map((a) => (
          <AreaEditor key={a.id} area={a} />
        ))}
      </section>
    </aside>
  );
}
