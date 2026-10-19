// Logika permainan avatar sendiri — tanpa React/Three, dipakai mode 2D & 3D.
// Gerak fisik diserahkan ke "mesin gerak" (Motion): Rapier di 3D, tabrakan kotak-lingkaran di 2D.
import type { Derived, Door, Seat, Zone } from "../../shared/layout";
import { ANIM, EMOTE_KEYS } from "./anims";

export const WALK = 4;
export const RUN = 7;
const SEND_INTERVAL = 1 / 15;
const PROXIMITY_INTERVAL = 1 / 4;

export type Vec3 = [number, number, number];

export interface Motion {
  position(): Vec3;
  setVelocity(vx: number, vz: number): void;
  teleport(x: number, z: number, y?: number): void;
  setEnabled(on: boolean): void; // false selama duduk (tanpa tabrakan)
}

export interface Input {
  held: Set<string>; // tombol yang sedang ditahan
  pressed: Set<string>; // tekanan baru yang belum diproses (C, F, 1/2/3)
  touch: { x: number; y: number }; // joystick sentuh
}

type GameRef = { type: "arcade" | "gameTable"; id: string };

/** Potongan state jaringan yang dibaca controller (subset useNet). */
export interface NetView {
  following: string | null;
  floor: string;
  players: Record<string, { floor: string }>;
  desks: Record<string, { locked: boolean; ownerId: string; ownerName: string }>;
  selfId: string | null;
  zoneId: string | null;
  nearDoor: string | null;
  nearSeat: string | null;
  nearLift: boolean;
  nearGame: GameRef | null;
  sitting?: boolean;
}

export interface ControllerIO {
  state(): NetView;
  patch(p: Partial<NetView> & { zone?: string | null }): void;
  remote(id: string): { p: Vec3; a: number } | undefined;
  remotes(): Iterable<{ p: Vec3; a: number }>;
  world(): Derived;
  zoneAt(x: number, z: number): Zone | null;
  doorNear(x: number, z: number): Door | null;
  seatNear(x: number, z: number, taken: (s: Seat) => boolean): Seat | null;
  ejectPoint(zone: Zone, x: number, z: number): [number, number];
  gameNear(x: number, z: number): GameRef | null;
  openGame(g: GameRef): void;
  sendMove(p: Vec3, r: number, a: number): void;
  sendDoor(id: string, inside: boolean): void;
  updateProximity(x: number, z: number): void;
  teleportNear(x: number, z: number, floor: string): void;
  focusNotice(ownerName: string): void;
  setSelfPos(p: Vec3): void;
}

export interface Controller {
  step(dt: number, now: number, camYaw: number): void;
  readonly anim: number;
  readonly facing: number; // arah hadap (rotation.y), 0 = menghadap +z (selatan)
  readonly seat: Seat | null;
  teleport(x: number, z: number): void;
  toggleSit(): void;
  standUp(): void;
}

/** Kursi yang sedang diduduki sudah tidak ada di denah (diubah/dihapus admin) → harus berdiri. */
export const seatMissing = (seat: Seat | null, seats: Seat[]) => !!seat && !seats.some((s) => s.id === seat.id);

export function dampAngle(from: number, to: number, k: number) {
  let d = to - from;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return from + d * k;
}

export function createController(motion: Motion, input: Input, io: ControllerIO): Controller {
  let anim: number = ANIM.idle;
  let facing = 0;
  let emote: { anim: number; until: number } | null = null;
  let seat: Seat | null = null;
  let sendTimer = 0;
  let proximityTimer = 0;
  let lastSent = "";
  let lastValid: [number, number] | null = null;
  let lastNotice = -Infinity;
  let followStuck = { dist: Infinity, since: 0 };

  /** Kursi sedang diduduki orang lain? (avatar lain berstatus duduk di dekat kursi itu) */
  const seatTaken = (s: Seat) => {
    for (const r of io.remotes()) if (r.a === ANIM.sit && Math.hypot(r.p[0] - s.x, r.p[2] - s.z) < 0.4) return true;
    return false;
  };

  const standUp = () => {
    const s = seat;
    if (!s) return;
    seat = null;
    motion.setEnabled(true);
    motion.teleport(s.stand[0], s.stand[1]);
    motion.setVelocity(0, 0);
    // Posisi diri ikut diperbarui sekarang juga: saat ganti mode tampilan, controller baru mulai dari sini.
    io.setSelfPos([s.stand[0], 0, s.stand[1]]);
    io.patch({ sitting: false });
  };

  const sitOn = (s: Seat) => {
    seat = s;
    emote = null;
    // Selama duduk, badan fisik dinonaktifkan supaya tidak bertabrakan dengan sofa/meja.
    motion.setEnabled(false);
    motion.teleport(s.x, s.z);
    facing = s.yaw;
    io.patch({ sitting: true, nearSeat: null });
  };

  const toggleSit = () => {
    if (seat) return standUp();
    const [x, , z] = motion.position();
    const s = io.seatNear(x, z, seatTaken);
    if (s) sitOn(s);
  };

  const teleport = (x: number, z: number) => {
    if (seat) standUp();
    motion.teleport(x, z);
    motion.setVelocity(0, 0);
  };

  function step(dt: number, now: number, camYaw: number) {
    const k = input.held;
    const pressed = input.pressed;

    // Input relatif terhadap arah kamera: W = maju menjauhi kamera. Joystick sentuh ikut dijumlahkan.
    let fwd = input.touch.y;
    let side = input.touch.x;
    if (k.has("KeyW") || k.has("ArrowUp")) fwd += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) fwd -= 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) side -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) side += 1;
    const sy = Math.sin(camYaw);
    const cy = Math.cos(camYaw);
    let x = -sy * fwd + cy * side;
    let z = -cy * fwd - sy * side;
    let len = Math.hypot(x, z);
    if (len < 0.15) len = 0; // zona mati joystick
    if (len === 0) x = z = 0;
    let running = k.has("ShiftLeft") || k.has("ShiftRight") || Math.hypot(input.touch.x, input.touch.y) > 0.92;

    // Mode ikuti: jalan otomatis ke orang yang diikuti; tombol gerak = berhenti mengikuti.
    const following = io.state().following;
    if (following && len > 0) io.patch({ following: null });
    else if (following) {
      const target = io.remote(following);
      const info = io.state().players[following];
      const [hx, , hz] = motion.position();
      if (!target || !info) io.patch({ following: null });
      else if (info.floor !== io.state().floor) {
        io.teleportNear(target.p[0], target.p[2], info.floor); // ikut naik lift
      } else {
        const dx = target.p[0] - hx;
        const dz = target.p[2] - hz;
        const dist = Math.hypot(dx, dz);
        if (dist > 1.8) {
          x = dx / dist;
          z = dz / dist;
          len = 1;
          running = dist > 6;
          // Tersangkut (dinding/furnitur) → lompat ke dekatnya.
          if (dist >= followStuck.dist - 0.05) {
            if (now - followStuck.since > 2.5) {
              io.teleportNear(target.p[0], target.p[2], io.state().floor);
              followStuck = { dist: Infinity, since: now };
            }
          } else followStuck = { dist, since: now };
        }
      }
    }
    const speed = running ? RUN : WALK;

    // Duduk / berdiri (C). Bergerak saat duduk = berdiri.
    if (pressed.has("KeyC")) {
      pressed.delete("KeyC");
      toggleSit();
    }
    if (seat && len > 0 && !following) standUp();
    if (seat && following) io.patch({ following: null });

    // Emote (1/2/3) — dibatalkan begitu avatar bergerak.
    for (const code in EMOTE_KEYS) {
      if (!pressed.has(code)) continue;
      pressed.delete(code);
      if (seat) continue;
      const e = EMOTE_KEYS[code];
      emote = { anim: e.anim, until: e.duration === null ? Infinity : now + e.duration };
    }
    if (len > 0 || (emote && now >= emote.until)) emote = null;

    if (seat) {
      anim = ANIM.sit;
    } else {
      anim = len > 0 ? (running ? ANIM.run : ANIM.walk) : (emote?.anim ?? ANIM.idle);
      if (len > 0) {
        const n = Math.max(1, len);
        x /= n;
        z /= n;
        facing = dampAngle(facing, Math.atan2(x, z), 1 - Math.exp(-12 * dt));
      }
      motion.setVelocity(x * speed, z * speed);
    }

    // Meja terkunci milik orang lain tidak bisa dimasuki: kembalikan ke posisi sah terakhir / dorong keluar.
    const p = motion.position();
    let px = p[0];
    let pz = p[2];
    const { desks, selfId } = io.state();
    const lockedFor = (qx: number, qz: number) => {
      const zn = io.zoneAt(qx, qz);
      const dk = zn ? desks[zn.id] : undefined;
      return dk && dk.locked && dk.ownerId !== selfId ? zn : null;
    };
    const blocked = lockedFor(px, pz);
    if (blocked) {
      if (seat) standUp();
      const lv = lastValid;
      const [ex, ez] = lv && !lockedFor(lv[0], lv[1]) ? lv : io.ejectPoint(blocked, px, pz);
      motion.teleport(ex, ez, p[1]);
      motion.setVelocity(0, 0);
      if (now - lastNotice > 3) {
        lastNotice = now;
        io.focusNotice(desks[blocked.id].ownerName);
      }
      px = ex;
      pz = ez;
    } else {
      lastValid = [px, pz];
    }
    io.setSelfPos([px, p[1], pz]);

    const here = io.zoneAt(px, pz);
    if (io.state().zoneId !== (here?.id ?? null)) io.patch({ zone: here?.name ?? null, zoneId: here?.id ?? null });

    // Pintu terdekat: F untuk buka/tutup/ketuk. Tanpa pintu di dekat, F membuka mesin arcade / meja game terdekat.
    const door = io.doorNear(px, pz);
    if (io.state().nearDoor !== (door?.id ?? null)) io.patch({ nearDoor: door?.id ?? null });
    if (pressed.has("KeyF")) {
      pressed.delete("KeyF");
      const game = io.state().nearGame;
      if (door) io.sendDoor(door.id, here?.id === door.room);
      else if (game) io.openGame(game);
    }

    // Audio/video proximity + kursi/lift/game terdekat (beberapa kali per detik saja).
    proximityTimer += dt;
    if (proximityTimer >= PROXIMITY_INTERVAL) {
      proximityTimer = 0;
      io.updateProximity(px, pz);
      const near = seat ? null : (io.seatNear(px, pz, seatTaken)?.id ?? null);
      if (io.state().nearSeat !== near) io.patch({ nearSeat: near });
      const lift = io.world().elevators.some((e) => Math.hypot(e.exit[0] - px, e.exit[1] - pz) < 2.2);
      if (io.state().nearLift !== lift) io.patch({ nearLift: lift });
      const game = io.gameNear(px, pz);
      if (io.state().nearGame?.id !== game?.id) io.patch({ nearGame: game });
    }

    // Kirim posisi maks 15x/detik, hanya kalau berubah.
    sendTimer += dt;
    if (sendTimer >= SEND_INTERVAL || lastSent === "") {
      sendTimer = 0;
      const sp: Vec3 = [px, p[1], pz];
      const key = `${sp.map((n) => n.toFixed(2)).join()}|${facing.toFixed(2)}|${anim}`;
      if (key !== lastSent) {
        lastSent = key;
        io.sendMove(sp, facing, anim);
      }
    }
  }

  return {
    step,
    get anim() {
      return anim;
    },
    get facing() {
      return facing;
    },
    get seat() {
      return seat;
    },
    teleport,
    toggleSit,
    standUp,
  };
}
