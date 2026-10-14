import { createRoot } from "react-dom/client";
import App from "./App";
import { remoteState, selfPos, useNet } from "./net";
import { room } from "./media";
import { useWhiteboard } from "./whiteboard";
import "./styles.css";

// Hook debug untuk tes otomatis (hanya mode dev).
if (import.meta.env.DEV) Object.assign(window, { __vo: { remoteState, room, useNet, selfPos, wb: () => Object.fromEntries(Object.entries(useWhiteboard.getState().boards).map(([k, v]) => [k, v.length])) } });

createRoot(document.getElementById("root")!).render(<App />);
