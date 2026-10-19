import { createRoot } from "react-dom/client";
import App from "./App";
import { remoteState, selfPos, useNet } from "./net";
import { room } from "./media";
import { useWhiteboard } from "./whiteboard";
import { useGraphics } from "./graphics";
import * as net from "./net";
import "@fontsource-variable/nunito";
import "./styles.css";
import { IconContext } from "@phosphor-icons/react";

// Hook debug untuk tes otomatis (hanya mode dev).
if (import.meta.env.DEV) Object.assign(window, { __vo: { remoteState, room, useNet, selfPos, useGraphics, net, wb: () => Object.fromEntries(Object.entries(useWhiteboard.getState().boards).map(([k, v]) => [k, v.length])) } });

// Ikon Phosphor: gaya duotone, sedikit lebih besar dari teks di sebelahnya.
createRoot(document.getElementById("root")!).render(
  <IconContext.Provider value={{ weight: "duotone", size: "1.15em" }}>
    <App />
  </IconContext.Provider>,
);
