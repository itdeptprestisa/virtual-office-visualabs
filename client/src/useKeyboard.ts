import { useEffect, useRef } from "react";
import { gameInput } from "./input";

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

// `held`: tombol yang sedang ditahan (gerak). `pressed`: tekanan baru yang belum diproses (aksi sekali tekan,
// mis. F/emote) — tidak hilang walau tombol sudah dilepas sebelum frame berikutnya.
export function useKeyboard() {
  const held = useRef(new Set<string>());
  const pressed = useRef(new Set<string>());

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target) || gameInput.active) return;
      held.current.add(e.code);
      if (!e.repeat) pressed.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => held.current.delete(e.code);
    const clear = () => {
      held.current.clear();
      pressed.current.clear();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    window.addEventListener("focusin", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      window.removeEventListener("focusin", clear);
    };
  }, []);

  return { held, pressed };
}
