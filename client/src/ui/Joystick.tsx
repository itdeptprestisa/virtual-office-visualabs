import { useRef, useState } from "react";
import { touchInput } from "../input";

const R = 56; // jari-jari gerak kenop (px)

/** Joystick sentuh untuk HP/tablet. Dorong penuh = lari. */
export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const active = useRef<number | null>(null);

  const update = (clientX: number, clientY: number) => {
    const r = base.current!.getBoundingClientRect();
    let dx = clientX - (r.left + r.width / 2);
    let dy = clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    setKnob([dx, dy]);
    touchInput.x = dx / R;
    touchInput.y = -dy / R;
  };
  const end = () => {
    active.current = null;
    setKnob([0, 0]);
    touchInput.x = 0;
    touchInput.y = 0;
  };

  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e.clientX, e.clientY)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="knob" style={{ transform: `translate(${knob[0]}px, ${knob[1]}px)` }} />
    </div>
  );
}
