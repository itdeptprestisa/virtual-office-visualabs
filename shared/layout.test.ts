import { test } from "node:test";
import assert from "node:assert/strict";
import { COLLIDERS } from "./furniture";
import { DECORATION_MOVES, DECORATION_TYPES, DECORATION_TYPES_2, PROXIMITY, isDecoration2, moveDecorations, zoneDepth, SPAWN, WORLD, addDecorations, defaultLayout, derive, linkIn, roomOf, sanitizeLayout, toWorld, zoneIn } from "./layout";

const d = derive(defaultLayout()).f1;
const d2 = derive(defaultLayout()).f2;
const zoneAt = (x: number, z: number) => zoneIn(d, x, z);
const connected = (ax: number, az: number, bx: number, bz: number) => linkIn(d, ax, az, bx, bz).distance < PROXIMITY.hear;

test("di luar zona: tersambung hanya bila dekat (≤ 4 m)", () => {
  assert.equal(zoneAt(0, 15), null);
  assert.equal(connected(0, 15, 3, 15), true);
  assert.equal(connected(0, 15, 0, 19.5), false);
  assert.equal(linkIn(d, 0, 15, 1.5, 15).volume, 1);
  assert.ok(linkIn(d, 0, 15, 3, 15).volume < 1);
});

test("Lantai 1: 6 divisi, masing-masing punya ruang manager, ruang rapat & 10 meja pekerja", () => {
  const f1 = defaultLayout().floors[0];
  for (let n = 1; n <= 6; n++) {
    const div = d.zones.find((z) => z.id === `room:divisi-${n}`)!;
    assert.equal(div.name, `Divisi ${n}`);
    assert.equal(div.audio, "near");
    assert.equal(d.zones.find((z) => z.id === `room:manager-${n}`)?.parent, div.id);
    assert.equal(d.zones.find((z) => z.id === `room:rapat-${n}`)?.parent, div.id);
    assert.equal(d.zones.filter((z) => z.kind === "desk" && z.parent === div.id).length, 10);
  }
  assert.equal(f1.items.filter((i) => i.type === "desk").length, 60);
  // fasilitas lama yang digantikan divisi sudah tidak ada
  for (const old of ["meeting", "fokus-a", "fokus-b"]) assert.ok(!f1.rooms.some((r) => r.id === old));
});

test("divisi: di area meja hanya terdengar jarak dekat; dari luar divisi tidak terdengar", () => {
  assert.equal(zoneAt(-23, -9.3)?.name, "Divisi 1");
  assert.equal(connected(-23, -9.3, -19.5, -9.3), true);
  assert.ok(linkIn(d, -23, -9.3, -19.5, -9.3).volume < 1);
  assert.equal(connected(-23, -9.3, -28.5, -9.3), false); // satu divisi tapi jauh
  assert.equal(zoneAt(-23, -6), null); // lorong tengah
  assert.equal(connected(-23, -6, -23, -9.3), false); // dekat tapi beda sisi dinding
  assert.equal(connected(-14, -9.3, -9, -9.3), false); // divisi sebelah
});

test("ruang manager & ruang rapat di dalam divisi: tertutup, di dalamnya saling dengar penuh", () => {
  assert.equal(zoneAt(-29.7, -21)?.name, "Manager Divisi 1");
  assert.deepEqual(linkIn(d, -31.5, -23.5, -28, -19.2), { distance: 0, volume: 1 });
  assert.equal(zoneAt(-18.8, -21)?.name, "Rapat Divisi 1");
  assert.deepEqual(linkIn(d, -23.5, -23.8, -14, -17.5), { distance: 0, volume: 1 });
  assert.equal(connected(-29.7, -21, -18.8, -21), false);
  assert.equal(zoneAt(-18.8, -16.4)?.name, "Divisi 1");
  assert.equal(connected(-18.8, -16.4, -18.8, -17.5), false); // berdiri di divisi, di luar dinding ruang rapat
  // divisi baris selatan (pintu ke utara): ruang manager di sisi selatan
  assert.equal(zoneAt(-29.7, 9)?.name, "Manager Divisi 4");
  assert.equal(zoneAt(-18.8, 9)?.name, "Rapat Divisi 4");
});

test("meja kerja di dalam divisi tetap jadi zona sendiri; datang ke meja = tersambung", () => {
  const desk = zoneAt(-30.2, -14.4)!;
  assert.equal(desk.kind, "desk");
  assert.equal(roomOf(d, desk)?.name, "Divisi 1");
  assert.equal(connected(-30.2, -14.4, -26.6, -14.4), false);
  assert.equal(connected(-30.2, -14.4, -29.8, -14.2), true);
});

test("ruang rapat: 12 kursi mengelilingi meja (5 di tiap sisi panjang + 1 di tiap ujung)", () => {
  const f1 = defaultLayout().floors[0];
  for (let n = 1; n <= 6; n++) {
    const chairs = f1.items.filter((i) => i.type === "chair" && zoneIn(d, i.x, i.z, true)?.id === `room:rapat-${n}`);
    assert.equal(chairs.length, 12, `rapat ${n}`);
    assert.equal(chairs.filter((c) => c.rot === 1 || c.rot === 3).length, 2, "kursi ujung");
  }
});

test("layar ruang rapat milik ruang rapat itu, bukan divisinya", () => {
  const screens = defaultLayout().floors[0].items.filter((i) => i.type === "screen");
  assert.equal(screens.length, 7); // 6 ruang rapat + town hall
  for (let n = 1; n <= 6; n++) assert.ok(screens.some((s) => zoneIn(d, s.x, s.z, true)?.id === `room:rapat-${n}`), `layar rapat ${n}`);
});

test("town hall tertutup: panggung terdengar ke seluruh aula, penonton jarak dekat, luar aula tidak dengar", () => {
  const stage: [number, number] = [0, -41];
  const st = zoneIn(d, ...stage)!;
  assert.equal(st.stage, true);
  assert.equal(st.parent, "room:townhall");
  assert.equal(zoneAt(0, -34)?.name, "Town Hall");
  assert.deepEqual(linkIn(d, 0, -34, ...stage), { distance: 0, volume: 1 });
  assert.deepEqual(linkIn(d, 15, -30, ...stage), { distance: 0, volume: 1 }); // pojok aula
  assert.equal(linkIn(d, 25, -36, ...stage).volume, 0); // di Ruang COO
  assert.equal(connected(0, -34, 2, -34), true);
  assert.equal(connected(0, -34, 6, -34), false);
  assert.equal(linkIn(d, 0, -26, ...stage).volume, 0); // lorong depan pintu aula
  assert.equal(linkIn(d, 0, -9.3, ...stage).volume, 0); // di divisi
  assert.equal(linkIn(d, 24, 20, ...stage).volume, 0); // di lounge
  // dinding kaca selatan aula ada, dengan celah pintu di tengah
  const south = d.walls.filter((w) => w.orient === "x" && w.c === -28 && w.a[0] >= -17 && w.a[1] <= 17);
  assert.equal(south.length, 2);
  for (const w of south) assert.ok(w.a[1] <= -1.6 + 1e-9 || w.a[0] >= 1.6 - 1e-9);
});

test("Ruang CEO & COO mengapit town hall: tertutup, suara penuh di dalam, pintu ke lorong", () => {
  const f1 = defaultLayout().floors[0];
  for (const [id, name, x] of [["ceo", "Ruang CEO", -25.1], ["coo", "Ruang COO", 25.1]] as const) {
    const zn = zoneAt(x, -36)!;
    assert.equal(zn.id, `room:${id}`);
    assert.equal(zn.name, name);
    assert.equal(zn.parent, undefined);
    assert.deepEqual(linkIn(d, x - 3, -42, x + 3, -30), { distance: 0, volume: 1 });
    assert.equal(connected(x, -29, x, -26), false); // lorong di depan pintu
    assert.equal(connected(Math.sign(x) * 17.5, -36, Math.sign(x) * 16.5, -36), false); // town hall di sebelahnya
    assert.equal(d.doors.find((dr) => dr.id === id)?.c, -28);
    const r = f1.rooms.find((rm) => rm.id === id)!;
    const inside = f1.items.filter((i) => i.x > r.x[0] && i.x < r.x[1] && i.z < r.z[1]);
    assert.equal(inside.filter((i) => i.type === "sofa").length, 2);
    assert.equal(inside.filter((i) => i.type === "chair").length, 5); // kursi kerja + 4 kursi rapat
    assert.equal(inside.filter((i) => i.type === "desk").length, 0); // tanpa zona meja, supaya tamu tetap terdengar
  }
});

test("town hall: 60 kursi penonton di dalam aula, menghadap panggung", () => {
  const chairs = defaultLayout().floors[0].items.filter((i) => i.type === "chair" && i.z < -28 && Math.abs(i.x) < 17);
  assert.equal(chairs.length, 60);
  for (const c of chairs) {
    assert.equal(c.rot, 2);
    assert.equal(roomOf(d, zoneAt(c.x, c.z))?.id, "room:townhall");
  }
});

test("toilet & mushola senyap: di dalam tidak saling dengar, dari luar pun tidak", () => {
  for (const [name, x] of [["Toilet", -10], ["Mushola", 10]] as const) {
    assert.equal(zoneAt(x, 21)?.name, name);
    assert.equal(zoneAt(x, 21)?.audio, "mute");
    assert.equal(linkIn(d, x, 21, x + 1, 21).volume, 0);
    assert.equal(linkIn(d, x, 16.5, x, 13.5).volume, 0);
  }
  const f1 = defaultLayout().floors[0];
  assert.equal(f1.items.filter((i) => i.type === "toilet").length, 8);
  assert.equal(f1.items.filter((i) => i.type === "sink").length, 4);
  const mats = f1.items.filter((i) => i.type === "prayerMat");
  assert.equal(mats.length, 15);
  for (const m of mats) assert.equal(m.rot, 3, "sajadah menghadap barat (kiblat)");
});

test("pantry: dapur + 3 meja makan × 4 kursi, suara jarak dekat", () => {
  const pantry = d.zones.find((z) => z.id === "area:pantry")!;
  assert.equal(pantry.audio, "near");
  const f1 = defaultLayout().floors[0];
  const tables = f1.items.filter((i) => i.type === "tableSmall" && zoneIn(d, i.x, i.z)?.id === pantry.id);
  assert.equal(tables.length, 3);
  assert.equal(f1.items.filter((i) => i.type === "chair" && zoneIn(d, i.x, i.z)?.id === pantry.id).length, 12);
  assert.equal(connected(-25, 16, -23, 16), true);
  assert.equal(connected(-30, 16, -18, 23), false);
});

test("titik muncul (spawn) tidak berada di dalam zona mana pun", () => {
  for (let x = SPAWN.x[0]; x <= SPAWN.x[1]; x += 0.5) for (let z = SPAWN.z[0]; z <= SPAWN.z[1]; z += 0.5) assert.equal(zoneAt(x, z), null, `${x},${z}`);
});

test("rotasi: kursi meja kerja ada di depan meja dan menghadap meja (baris utara & selatan)", () => {
  assert.deepEqual(toWorld({ x: 0, z: 0, rot: 1 }, 0, 1), [1, 0]);
  const desks = defaultLayout().floors[0].items.filter((i) => i.type === "desk");
  const north = desks.find((i) => i.x === -30.2 && i.z === -14.9)!;
  const sn = d.seats.find((s) => s.itemId === north.id)!;
  assert.ok(Math.abs(sn.z - -14.15) < 1e-9);
  assert.ok(Math.abs(Math.cos(sn.yaw) + 1) < 1e-9); // menghadap -z (ke meja)
  const south = desks.find((i) => i.x === -30.2 && i.rot === 2)!;
  const ss = d.seats.find((s) => s.itemId === south.id)!;
  assert.ok(Math.abs(ss.z - (south.z - 0.75)) < 1e-9);
  assert.ok(Math.abs(Math.cos(ss.yaw) - 1) < 1e-9); // menghadap +z
});

test("semua furnitur berada di dalam gedung", () => {
  for (const f of defaultLayout().floors)
    for (const i of f.items) assert.ok(i.x > WORLD.minX && i.x < WORLD.maxX && i.z > WORLD.minZ && i.z < WORLD.maxZ, `${i.type} ${i.x},${i.z}`);
});

test("sanitizeLayout menerima denah bawaan & menolak data rusak", () => {
  assert.deepEqual(sanitizeLayout(defaultLayout()), defaultLayout());
  const floor = (items: unknown[]) => ({ floors: [{ id: "f1", name: "L1", rooms: [], areas: [], items }] });
  assert.equal(sanitizeLayout(floor([{ id: "a", type: "rocket", x: 0, z: 0, rot: 0 }])), null);
  assert.equal(sanitizeLayout(floor([{ id: "a", type: "desk", x: 0, z: 0, rot: 0 }, { id: "a", type: "desk", x: 1, z: 0, rot: 0 }])), null);
  // id harus unik di seluruh lantai
  const l = defaultLayout();
  l.floors[1].items[0].id = l.floors[0].items[0].id;
  assert.equal(sanitizeLayout(l), null);
});

test("denah lama (v1, satu lantai) otomatis diubah ke v2", () => {
  const v1 = { rooms: [], areas: [], items: [{ id: "d1", type: "desk", x: 0, z: 0, rot: 0 }] };
  const l = sanitizeLayout(v1)!;
  assert.equal(l.version, 2);
  assert.equal(l.floors.length, 1);
  assert.equal(l.floors[0].items[0].id, "d1");
});

test("Lantai 2 = arcade: tanpa ruangan & area, ada mesin arcade dan meja Empat Sejajar", () => {
  const f2 = defaultLayout().floors[1];
  assert.equal(f2.rooms.length, 0);
  assert.equal(f2.areas.length, 0);
  assert.equal(f2.items.filter((i) => i.type === "arcade").length, 4);
  assert.equal(f2.items.filter((i) => i.type === "gameTable").length, 4);
  const chairs = new Set(f2.items.filter((i) => i.type === "chair").map((i) => i.id));
  assert.equal(d2.seats.filter((x) => chairs.has(x.itemId)).length, 8, "dua kursi per meja");
});

test("lift ada di kedua lantai, di posisi yang sama, dengan titik keluar di depan pintunya", () => {
  assert.deepEqual([d.elevators[0].x, d.elevators[0].z], [d2.elevators[0].x, d2.elevators[0].z]);
  for (const dd of [d, d2]) {
    assert.equal(dd.elevators.length, 1);
    const e = dd.elevators[0];
    assert.equal(zoneIn(dd, ...e.exit), null);
    assert.ok(Math.hypot(e.exit[0] - e.x, e.exit[1] - e.z) > 1);
  }
});

test("dekorasi: tiap divisi punya jam, bingkai, dispenser & tempat sampah; ada printer, jendela, lampu & rak majalah", () => {
  const f1 = defaultLayout().floors[0];
  const inRoom = (type: string, room: string) => f1.items.filter((i) => i.type === type && roomOf(d, zoneIn(d, i.x, i.z, true))?.id === room).length;
  for (let n = 1; n <= 6; n++) for (const type of ["clock", "frame", "dispenser", "bin"]) assert.ok(inRoom(type, `room:divisi-${n}`) >= 1, `${type} di divisi ${n}`);
  for (const [type, min] of [["printer", 2], ["window", 6], ["floorLamp", 3], ["magazineRack", 2]] as const) assert.ok(f1.items.filter((i) => i.type === type).length >= min, type);
  // dekorasi padat tidak menghalangi pintu: tidak ada collider dalam 1,2 m dari tengah pintu
  for (const dr of d.doors) {
    const mid = (dr.a[0] + dr.a[1]) / 2;
    const [x, z] = dr.orient === "x" ? [mid, dr.c] : [dr.c, mid];
    for (const i of f1.items) if (["dispenser", "printer", "bin", "floorLamp", "magazineRack"].includes(i.type)) assert.ok(Math.hypot(i.x - x, i.z - z) > 1.2, `${i.type} menghalangi pintu ${dr.id}`);
  }
});

test("denah tersimpan lama mendapat dekorasi bawaan sekali; lantai yang sudah berdekorasi tidak digandakan", () => {
  const def = defaultLayout();
  const isDeco = (t: string) => (DECORATION_TYPES as readonly string[]).includes(t);
  // denah lama: tanpa dekorasi, admin sudah menghapus lantai 2
  const old = { ...def, floors: [{ ...def.floors[0], items: def.floors[0].items.filter((i) => !isDeco(i.type)) }] };
  const merged = addDecorations(old, def);
  const decos = merged.floors[0].items.filter((i) => isDeco(i.type));
  assert.equal(decos.length, def.floors[0].items.filter((i) => isDeco(i.type)).length);
  assert.equal(merged.floors.length, 1); // lantai yang dihapus admin tidak dihidupkan lagi
  assert.equal(new Set(merged.floors[0].items.map((i) => i.id)).size, merged.floors[0].items.length); // id unik
  assert.ok(sanitizeLayout(merged));
  // sudah ada dekorasi (mis. hasil gabungan sebelumnya / ditambah admin) → tidak ditambah lagi
  assert.equal(addDecorations(merged, def).floors[0].items.length, merged.floors[0].items.length);
});

const isDeco2 = (t: string) => (DECORATION_TYPES_2 as readonly string[]).includes(t);

test("dekorasi tambahan: lorong, pantry & lounge, dinding & resepsionis, dan Lantai 2 terisi", () => {
  const [f1, f2] = defaultLayout().floors;
  const count = (f: typeof f1, type: string) => f.items.filter((i) => i.type === type).length;
  for (const [type, min] of [["treePlant", 4], ["noticeBoard", 2], ["beanBag", 2], ["coffeeMachine", 1], ["vending", 1], ["snackShelf", 1], ["barStool", 4], ["hangingPlant", 2], ["poster", 4], ["wallShelf", 2], ["tv", 1], ["logoBoard", 1], ["rugRect", 1]] as const)
    assert.ok(count(f1, type) >= min, `Lantai 1: ${type} ${count(f1, type)} < ${min}`);
  for (const [type, min] of [["pingPong", 2], ["foosball", 2], ["billiard", 2], ["prizeShelf", 1], ["playRug", 1], ["beanBag", 2]] as const)
    assert.ok(count(f2, type) >= min, `Lantai 2: ${type} ${count(f2, type)} < ${min}`);
});

test("dekorasi tambahan yang padat tidak menghalangi pintu & tidak menumpuk dengan furnitur lain", () => {
  for (const f of defaultLayout().floors) {
    const df = derive(defaultLayout())[f.id];
    const box = (i: (typeof f.items)[number]) => {
      const c = COLLIDERS[i.type]!;
      const a = toWorld(i, c.pos[0] - c.half[0], c.pos[2] - c.half[2]);
      const b = toWorld(i, c.pos[0] + c.half[0], c.pos[2] + c.half[2]);
      return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
    };
    const solid = f.items.filter((i) => COLLIDERS[i.type]);
    for (const i of solid.filter((i) => isDeco2(i.type))) {
      const bi = box(i);
      assert.ok(bi.x0 > WORLD.minX && bi.x1 < WORLD.maxX && bi.z0 > WORLD.minZ && bi.z1 < WORLD.maxZ, `${i.type} di luar gedung`);
      for (const dr of df.doors) {
        const mid = (dr.a[0] + dr.a[1]) / 2;
        const [x, z] = dr.orient === "x" ? [mid, dr.c] : [dr.c, mid];
        assert.ok(Math.hypot(i.x - x, i.z - z) > 1.5, `${i.type} (${i.x},${i.z}) menghalangi pintu ${dr.id}`);
      }
      for (const o of solid) {
        if (o === i) continue;
        const bo = box(o);
        const overlap = bi.x0 < bo.x1 && bo.x0 < bi.x1 && bi.z0 < bo.z1 && bo.z0 < bi.z1;
        assert.ok(!overlap, `${i.type} (${i.x},${i.z}) menumpuk dengan ${o.type} (${o.x},${o.z}) di ${f.id}`);
      }
    }
  }
});

test("bean bag & kursi bar bisa diduduki", () => {
  const all = derive(defaultLayout());
  const itemsWithSeats = new Set(Object.values(all).flatMap((x) => x.seats.map((s) => s.itemId)));
  for (const f of defaultLayout().floors) for (const i of f.items) if (i.type === "beanBag" || i.type === "barStool") assert.ok(itemsWithSeats.has(i.id), `${i.type} ${i.id}`);
});

test("migrasi kedua: denah yang sudah punya dekorasi gelombang pertama mendapat dekorasi tambahan sekali", () => {
  const def = defaultLayout();
  const withoutBatch2 = { ...def, floors: def.floors.map((f) => ({ ...f, items: f.items.filter((i) => !isDecoration2(i)) })) };
  const merged = addDecorations(withoutBatch2, def, isDecoration2);
  for (const [k, f] of merged.floors.entries()) assert.equal(f.items.length, def.floors[k].items.length);
  assert.ok(merged.floors[1].items.some((i) => i.type === "sofa" && isDecoration2(i)), "sofa sudut gaming ikut");
  assert.ok(sanitizeLayout(merged));
  assert.equal(addDecorations(merged, def, isDecoration2).floors[0].items.length, merged.floors[0].items.length);
});

// Persimpangan lorong Lantai 1: lorong tegak antar kolom divisi × lorong mendatar (utara, tengah, selatan).
const CROSSINGS = [[-13, -10], [10, 13]].flatMap(([x0, x1]) => [[-28, -24.5], [-8.5, -3.5], [12.5, 15.5]].map(([z0, z1]) => ({ x0, x1, z0, z1 })));

test("persimpangan lorong bebas penghalang", () => {
  const f1 = defaultLayout().floors[0];
  for (const i of f1.items) {
    const c = COLLIDERS[i.type];
    if (!c) continue;
    const a = toWorld(i, c.pos[0] - c.half[0], c.pos[2] - c.half[2]);
    const b = toWorld(i, c.pos[0] + c.half[0], c.pos[2] + c.half[2]);
    const [x0, x1, z0, z1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[1], b[1])];
    for (const r of CROSSINGS) assert.ok(!(x0 < r.x1 && r.x0 < x1 && z0 < r.z1 && r.z0 < z1), `${i.type} (${i.x}, ${i.z}) menghalangi persimpangan`);
  }
});

test("migrasi: penghalang di persimpangan pada denah tersimpan dipindah — kecuali sudah dipindah admin", () => {
  const def = defaultLayout();
  const f1 = def.floors[0];
  // denah tersimpan versi lama: printer & tanaman masih di persimpangan, satu printer sudah dipindah admin
  const old = { ...def, floors: [{ ...f1, items: f1.items.map((i) => {
    const m = DECORATION_MOVES.find((mv) => mv.type === i.type && mv.to[0] === i.x && mv.to[1] === i.z);
    return m ? { ...i, x: m.from[0], z: m.from[1] } : i;
  }) }, def.floors[1]] };
  const adminMoved = old.floors[0].items.find((i) => i.type === "printer")!;
  adminMoved.x = 0;
  adminMoved.z = 5;
  const fixed = moveDecorations(old, DECORATION_MOVES);
  for (const m of DECORATION_MOVES) assert.ok(!fixed.floors[0].items.some((i) => i.type === m.type && i.x === m.from[0] && i.z === m.from[1]), `${m.type} masih di ${m.from}`);
  assert.ok(fixed.floors[0].items.some((i) => i.id === adminMoved.id && i.x === 0 && i.z === 5), "pindahan admin dipertahankan");
});

test("kedalaman zona: ruang manager/rapat & meja di dalam divisi lebih dalam dari divisinya (dipakai untuk urutan lapisan lantai 3D)", () => {
  const div = d.zones.find((z) => z.id === "room:divisi-1")!;
  const mgr = d.zones.find((z) => z.id === "room:manager-1")!;
  const rapat = d.zones.find((z) => z.id === "room:rapat-1")!;
  assert.equal(zoneDepth(d.zones, div), 0);
  assert.equal(zoneDepth(d.zones, mgr), 1);
  assert.equal(zoneDepth(d.zones, rapat), 1);
  const desk = d.zones.find((z) => z.kind === "desk" && z.parent === div.id)!;
  assert.equal(zoneDepth(d.zones, desk), 1);
  assert.ok(Math.max(...d.zones.map((z) => zoneDepth(d.zones, z))) <= 3);
});
