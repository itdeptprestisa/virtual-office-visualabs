// Sambungan controller ke modul aplikasi (jaringan, denah aktif, media, game). Dipisah supaya controller bisa dites.
import type { ControllerIO, NetView } from "./controller";
import { doorPrimaryAction, remoteState, selfPos, sendDoor, sendMove, showNotice, useNet } from "./net";
import { doorNear, ejectPoint, seatNear, world, zoneAt } from "./zones";
import { updateProximity } from "./media";
import { gameNear, openGame } from "./games";
import { teleportNear } from "./actions";
import { t } from "./i18n";

export const defaultIO: ControllerIO = {
  state: () => useNet.getState() as unknown as NetView,
  patch: (p) => useNet.setState(p as never),
  remote: (id) => remoteState.get(id),
  remotes: () => remoteState.values(),
  world,
  zoneAt,
  doorNear,
  seatNear,
  ejectPoint: (zn, x, z) => ejectPoint(zn, x, z),
  gameNear,
  openGame,
  sendMove,
  sendDoor: (id, inside) => sendDoor(id, doorPrimaryAction(id, inside)),
  updateProximity,
  teleportNear: (x, z, floor) => teleportNear(x, z, floor),
  focusNotice: (name) => showNotice(t("{name} sedang mode fokus — jangan diganggu dulu ya", { name }), "lock"),
  setSelfPos: (p) => {
    selfPos.p = p;
  },
};
