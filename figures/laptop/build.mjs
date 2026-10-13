import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import * as A from "../../kit/audit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";

const W = 720;
const H = 900;
const AZIMUTH = 36;
const ELEVATION = 24;

const BASE = { x: -150, y: -95, w: 300, d: 190, r: 2 };
const FZ0 = 2;
const FZ1 = 4.5;
const WALL_TOP = 22;
const WT = 3.5;
const BOARD_Z0 = 8.5;
const BOARD_Z1 = 10.1;
const DECK_Z0 = 22;
const DECK_Z1 = 25;
const LID_Z0 = 40;
const LID_H = 175;
const LID_Y = -95;
const FAN = { x: 60, y: -26, r: 24, z: 10.1, h: 8 };
const HINGE_Y = -91.5;

const PIECES = {
  base: { name: "Coque inférieure", move: [0, 0, 0], say: "coque inférieure · le châssis, quatre pieds", desc: "Le châssis porte tout le reste. Quatre pieds en caoutchouc l'isolent de la table, des bossages reçoivent les vis, et des découpes sur le côté laissent sortir les ports." },
  battery: { name: "Batterie", move: [0, 0, 20], say: "batterie · cellules lithium-ion, 8 à 12 h", desc: "Un pack plat de cellules lithium-ion stocke l'énergie, environ 50 à 70 Wh. Elle occupe l'avant de la machine, sous le repose-poignets." },
  board: { name: "Carte mère", move: [0, 0, 40], say: "carte mère · relie tous les composants", desc: "Une plaque de circuits imprimés relie le processeur, la mémoire et le stockage par des milliers de pistes de cuivre. Les ports USB, HDMI et audio sont soudés sur son bord." },
  cpu: { name: "Processeur", move: [0, 0, 72], say: "processeur · des milliards de transistors", desc: "Le CPU exécute les instructions du programme en boucle : chercher, décoder, exécuter, des milliards de fois par seconde. Il chauffe beaucoup, donc il porte un répartiteur de chaleur." },
  ram: { name: "Mémoire vive", move: [0, 0, 64], say: "mémoire vive · deux barrettes", desc: "La RAM garde ce qui sert maintenant : programmes ouverts, documents en cours. Très rapide, mais elle se vide quand on éteint la machine." },
  ssd: { name: "SSD", move: [0, 0, 64], say: "SSD · stockage durable", desc: "Le SSD conserve le système et vos fichiers, même éteint. Plus lent que la RAM mais sans pièce mobile. Format M.2, enfiché d'un côté et vissé de l'autre." },
  cooling: { name: "Refroidissement", move: [0, 0, 108], say: "refroidissement · caloduc et ventilateur", desc: "Le processeur chauffe. Une plaque et un caloduc conduisent la chaleur vers des ailettes, et le ventilateur souffle l'air au travers pour le faire sortir sur le côté." },
  deck: { name: "Clavier et coque supérieure", move: [0, 0, 215], say: "clavier et pavé tactile · vos entrées", desc: "La coque supérieure ferme la machine et porte vos entrées : le clavier, le pavé tactile et les haut-parleurs. Elle se visse sur le châssis." },
  lid: { name: "Écran", move: [0, -125, 225], say: "écran · dalle, charnières, webcam", desc: "Une dalle LCD ou OLED sous une vitre, avec la webcam dans le cadre. Deux charnières la relient à la base et permettent de l'ouvrir à l'angle voulu." },
  stand: { name: "Table", move: [0, 0, 0], say: "" },
};
const ORDER = ["base", "battery", "board", "cpu", "ram", "ssd", "cooling", "deck", "lid"];
const STAGGER = [...ORDER].reverse().concat("stand");
const SPRING = { stagger: 0.05, stiffness: 64, damping: 14.2, substeps: 4 };

const lift = (id) => PIECES[id].move;
const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -3, 30),
    ...k.boxCorners({ x: -150, y: -95, w: 300, d: 190 }, 0, 30 + lift("deck")[2]),
    ...k.boxCorners({ x: -150, y: LID_Y + lift("lid")[1], w: 300, d: 8 }, LID_Z0 + lift("lid")[2], LID_Z0 + LID_H + lift("lid")[2]),
  ],
  W,
  H,
  { pad: 30, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);

const R = A.recorder(P, { order: STAGGER, spring: SPRING });

function put(piece, ref, svg, { bias = 0, shapes = [], name } = {}) {
  R.put({ piece, ride: piece, at: ref, bias, svg, move: PIECES[piece].move, shapes, name: name ?? R.nameFor(`${piece}.item`) });
}
function slabPart(piece, name, plan, z, h, { steps = 3, bevel = 0, tone = "mid", crease, extra = "", inner = "", bias = 0, owner, flat } = {}) {
  const id = R.nameFor(`${piece}.${name}`);
  const style = { tone, ...(crease ? { crease } : {}), ...(flat ? { flat } : {}), ...(inner ? { inner: Ln(inner, { tone: "faint" }) } : {}) };
  put(piece, [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], S(k.slabOf(plan, z, h, P, steps, bevel), style) + extra, {
    bias,
    name: id,
    shapes: [R.solid(A.slab(plan, z, h, { name: id, owner }, steps))],
  });
  return id;
}
function cylPart(piece, name, cx, cy, r, z, h, { steps = 24, bevel = 0, tone = "mid", crease, extra = "", inner = "", bias = 0, owner } = {}) {
  const id = R.nameFor(`${piece}.${name}`);
  const style = { tone, ...(crease ? { crease } : {}), ...(inner ? { inner: Ln(inner, { tone: "faint" }) } : {}) };
  put(piece, [cx, cy, z + h / 2], S(k.cylinder(cx, cy, r, z, h, P, steps, bevel), style) + extra, {
    bias,
    name: id,
    shapes: [R.solid(A.cylinder(cx, cy, r, z, h, { name: id, owner }))],
  });
  return id;
}
const facePathX = (x, y0, y1, z0, z1) => k.pathOf([at([x, y0, z0]), at([x, y1, z0]), at([x, y1, z1]), at([x, y0, z1])], true);
const planeOf = (y) => k.sideMatrix([0, y], 0, P, "left");
const flat = (x0, z0, x1, z1, r, steps = 5) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([u, z]) => [u, -z]), true);

const MAT = { x: -176, y: -118, w: 352, d: 236, r: 14 };
{
  const id = "stand.mat";
  put("stand", [0, 0, -1.5], `<path class="iso-halo" d="${k.haloOf(MAT, -3, 3, P)}"/>` + S(k.slabOf(MAT, -3, 3, P, 8, 0.6), { tone: "lo" }) + Ln(k.planOutline(k.insetPlan(MAT, 6), 0, P, 8), { tone: "faint" }), {
    name: id,
    shapes: [R.solid(A.slab(MAT, -3, 3, { name: id, ground: true }, 8))],
  });
}

function tray() {
  for (const [x, y] of [[-125, -75], [125, -75], [-125, 75], [125, 75]]) {
    cylPart("base", "foot", x, y, 7, 0, FZ0, { tone: "lo", steps: 20 });
  }
  slabPart("base", "floor", BASE, FZ0, FZ1 - FZ0, {
    steps: 3,
    bevel: 0.5,
    tone: "mid",
    extra: Ln(k.planOutline(k.insetPlan(BASE, 7), FZ1, P, 3), { tone: "faint" }),
  });
  const wall = (name, plan, extra = "", inner = "") => slabPart("base", name, plan, FZ1, WALL_TOP - FZ1, { steps: 2, bevel: 0.4, tone: "mid", extra, inner });
  wall("wall-left", { x: BASE.x, y: BASE.y, w: WT, d: BASE.d, r: 1 }, Dots([at([BASE.x + WT, -60, WALL_TOP]), at([BASE.x + WT, 60, WALL_TOP])], { size: 0.4 }));
  const cuts = [[-69, -57, 11.1, 15.1], [-49.5, -41.5, 11.1, 13.5], [-35, -21, 11.1, 14.1]];
  const rightExtra =
    Ln(cuts.map(([y0, y1, z0, z1]) => facePathX(BASE.x + BASE.w, y0, y1, z0, z1)).join("") + k.sideRing([BASE.x + BASE.w, -8, 12.1], 2.8, "y", P, 14), { tone: "lo" }) +
    Dots([at([BASE.x + BASE.w, -80, 18]), at([BASE.x + BASE.w, 40, 18]), at([BASE.x + BASE.w, 80, 18])], { size: 0.4 });
  wall("wall-right", { x: BASE.x + BASE.w - WT, y: BASE.y, w: WT, d: BASE.d, r: 1 }, rightExtra);
  const vents = [];
  for (let i = 0; i < 9; i++) vents.push(k.segment([-100 + i * 8, BASE.y + WT, 8], [-100 + i * 8, BASE.y + WT, 18], P));
  wall("wall-rear", { x: BASE.x + WT, y: BASE.y, w: BASE.w - WT * 2, d: WT, r: 1 }, "", "");
  wall("wall-front", { x: BASE.x + WT, y: BASE.y + BASE.d - WT, w: BASE.w - WT * 2, d: WT, r: 1 }, Dots([at([-100, BASE.y + BASE.d, 14]), at([100, BASE.y + BASE.d, 14])], { size: 0.45 }));
  for (const [x, y] of [[-142.5, -87.5], [142.5, -87.5], [-142.5, 87.5], [142.5, 87.5]]) {
    cylPart("base", "post", x, y, 4, FZ1, WALL_TOP - FZ1, { tone: "mid", steps: 16, crease: "none", extra: Ln(k.ring(x, y, 1.8, WALL_TOP, P, 12), { tone: "lo" }) });
  }
  for (const [x, y] of [[-128, 12], [128, 12], [128, -78], [-48, -78]]) {
    cylPart("base", "standoff", x, y, 3, FZ1, BOARD_Z0 - FZ1, { tone: "mid", steps: 14, crease: "none" });
  }
}

const BAT = { x: -120, y: 30, w: 240, d: 58, r: 4 };
const BAT_Z = FZ1;
const BAT_H = 9;
function battery() {
  const top = BAT_Z + BAT_H;
  const seams = [-60, 0, 60].map((x) => k.lineOnTop([x, BAT.y], [x, BAT.y + BAT.d], top, P)).join("");
  slabPart("battery", "pack", BAT, BAT_Z, BAT_H, {
    steps: 4,
    bevel: 0.8,
    tone: "hi",
    crease: "lo",
    extra: Ln(k.planOutline(k.insetPlan(BAT, 3), top, P, 4), { tone: "faint" }) + Ln(seams, { tone: "faint" }) + Dots(k.corners(BAT, 6).map(([x, y]) => at([x, y, top])), { size: 0.45 }),
    inner: k.sideSeam(BAT, BAT_Z + 4.5, P, 4),
  });
  const label = { x: -40, y: 48, w: 80, d: 24, r: 2 };
  slabPart("battery", "label", label, top, 0.6, {
    steps: 3,
    tone: "lo",
    crease: "none",
    extra: Ln([46, 30, 38].map((w, i) => k.lineOnTop([label.x + 6, label.y + 6 + i * 6], [label.x + 6 + w, label.y + 6 + i * 6], top + 0.6, P)).join(""), { tone: "lo", free: true }) + Dots([at([label.x + label.w - 4, label.y + 4, top + 0.6]), at([label.x + label.w - 4, label.y + label.d - 4, top + 0.6])], { size: 0.4 }),
  });
  const conn = { x: -12, y: 25, w: 24, d: 5, r: 1 };
  slabPart("battery", "connector", conn, 6, 5, {
    steps: 2,
    tone: "mid",
    extra: Dots([-8, -4, 0, 4, 8].map((x) => at([x, 27.5, 11])), { size: 0.4 }),
  });
}

const BOARD = { x: -138, y: -86, w: 276, d: 104, r: 3 };
function board() {
  const top = BOARD_Z1;
  const holes = [[-128, 12], [128, 12], [128, -78], [-48, -78]];
  const trace = (pts, size = 0.8) => k.wireSvg(at(pts[0]), at(pts[pts.length - 1]), { via: pts.slice(1, -1).map(at), tone: "faint", size });
  const traces = [];
  for (let i = 0; i < 4; i++) traces.push(trace([[-34, -58 + i * 3.4, top], [-48, -58 + i * 3.4, top], [-52, -54 + i * 3.4, top], [-60, -54 + i * 3.4, top]]));
  for (let i = 0; i < 3; i++) traces.push(trace([[-24 + i * 4, -62, top], [-24 + i * 4, -66 - i * 2, top], [-56, -66 - i * 2, top], [-56, -80 + i * 2.2, top]]));
  for (let i = 0; i < 3; i++) traces.push(trace([[-28 + i * 5, -42, top], [-28 + i * 5, -30 + i * 3, top], [-20, -30 + i * 3, top], [-20, 6 - i * 1.5, top]]));
  slabPart("board", "pcb", BOARD, BOARD_Z0, BOARD_Z1 - BOARD_Z0, {
    steps: 3,
    bevel: 0.4,
    tone: "mid",
    crease: "lo",
    extra:
      Ln(k.planOutline(k.insetPlan(BOARD, 3), top, P, 3), { tone: "faint" }) +
      Ln(holes.map(([x, y]) => k.ring(x, y, 3.6, top, P, 14)).join(""), { tone: "lo" }) +
      traces.join(""),
  });
  for (const [x, y] of holes) cylPart("board", "screw", x, y, 2.4, top, 1, { tone: "hi", steps: 12, crease: "none", extra: Ln(k.lineOnTop([x - 1.4, y], [x + 1.4, y], top + 1, P), { tone: "lo" }) });
  const ports = [
    ["usb-a", { x: 128, y: -70, w: 18.5, d: 14, r: 1.5 }, 6],
    ["usb-c", { x: 130, y: -50, w: 16.5, d: 9, r: 2 }, 4],
    ["hdmi", { x: 128, y: -36, w: 18.5, d: 16, r: 1 }, 5],
    ["audio", { x: 134, y: -12, w: 12.5, d: 8, r: 3.5 }, 4],
  ];
  for (const [name, plan, h] of ports) {
    const t = top + h;
    slabPart("board", name, plan, top, h, { steps: 3, bevel: 0.3, tone: "hi", crease: "lo", extra: Ln(k.planOutline(k.insetPlan(plan, 1.6), t, P, 3), { tone: "faint" }) });
  }
  for (const [name, plan, h] of [
    ["ram-socket-a", { x: -132, y: -84, w: 68, d: 4, r: 0.6 }, 2.9],
    ["ram-socket-b", { x: -132, y: -56, w: 68, d: 4, r: 0.6 }, 2.9],
    ["ssd-socket", { x: -134, y: -24, w: 4, d: 18, r: 0.6 }, 2.9],
  ]) {
    slabPart("board", name, plan, top, h, { steps: 2, tone: "lo", crease: "none", extra: Dots(name === "ssd-socket" ? [at([plan.x + 2, plan.y + 4, top + h]), at([plan.x + 2, plan.y + 9, top + h]), at([plan.x + 2, plan.y + 14, top + h])] : [-124, -108, -92, -76].map((x) => at([x, plan.y + 2, top + h])), { size: 0.4 }) });
  }
  cylPart("board", "ssd-standoff", -63, -15, 3, top, 1.4, { tone: "mid", steps: 14, crease: "none" });
  for (let i = 0; i < 3; i++) slabPart("board", "choke", { x: -40 + i * 12, y: -84, w: 9, d: 9, r: 1.5 }, top, 2, { steps: 3, bevel: 0.3, tone: "mid", extra: Ln(k.planOutline({ x: -38.6 + i * 12, y: -82.6, w: 6.2, d: 6.2, r: 1 }, top + 2, P, 3), { tone: "faint" }) });
  for (let i = 0; i < 6; i++) cylPart("board", "cap", 30 + i * 8, -78, 2.2, top, 1.8, { tone: "lo", steps: 14, extra: Ln(k.ring(30 + i * 8, -78, 1.2, top + 1.8, P, 10), { tone: "faint" }) });
  for (const x of [-100, -86, -72]) slabPart("board", "chip", { x, y: 4, w: 9, d: 9, r: 1 }, top, 1, { steps: 2, tone: "mid", extra: Dots([at([x + 2, 8.5, top + 1])], { size: 0.35 }) });
  slabPart("board", "zif-a", { x: -60, y: 8, w: 30, d: 5, r: 0.8 }, top, 1.7, { steps: 2, tone: "lo", extra: Dots([-54, -48, -42, -36].map((x) => at([x, 10.5, top + 1.7])), { size: 0.35 }) });
  slabPart("board", "zif-b", { x: 20, y: 8, w: 40, d: 5, r: 0.8 }, top, 1.7, { steps: 2, tone: "lo", extra: Dots([26, 34, 42, 50].map((x) => at([x, 10.5, top + 1.7])), { size: 0.35 }) });
  cylPart("board", "cmos", 0, -2, 7, top, 3, { tone: "mid", steps: 24, bevel: 0.4, extra: Ln(k.ring(0, -2, 4.4, top + 3, P, 16), { tone: "faint" }) });
}

const CPU = { x: -34, y: -62, w: 20, d: 20, r: 2 };
function cpu() {
  slabPart("cpu", "package", CPU, BOARD_Z1, 1.4, { steps: 3, bevel: 0.3, tone: "mid", extra: Dots(k.corners(CPU, 2.2).map(([x, y]) => at([x, y, BOARD_Z1 + 1.4])), { size: 0.35 }) });
  const sp = { x: -30, y: -58, w: 12, d: 12, r: 1.5 };
  slabPart("cpu", "spreader", sp, BOARD_Z1 + 1.4, 1, { steps: 3, bevel: 0.3, tone: "hi", crease: "lo", extra: Ln(k.planOutline(k.insetPlan(sp, 2), BOARD_Z1 + 2.4, P, 3), { tone: "faint" }) });
}

const PLATE = { x: -40, y: -68, w: 32, d: 32, r: 2 };
const PIPE = { x: -8, y: -62, w: 92, d: 10, r: 3 };
const STACK = { x: 84, y: -70, w: 16, d: 64, r: 1 };
const COOL_Z = 12.5;
const fanBlades = (angle) => {
  const out = [];
  const count = 9;
  const z = FAN.z + FAN.h + 0.1;
  for (let i = 0; i < count; i++) {
    const a0 = angle + (i * Math.PI * 2) / count;
    const pts = [];
    for (let s = 0; s <= 6; s++) {
      const r = 5.6 + (s / 6) * 14.2;
      const a = a0 + (s / 6) * 0.9;
      pts.push([FAN.x + Math.sin(a) * r, FAN.y - Math.cos(a) * r]);
    }
    out.push(k.onTop(pts, z, P));
  }
  return out.join("");
};
function cooling() {
  const owner = "cooling";
  slabPart("cooling", "plate", PLATE, COOL_Z, 2.5, {
    steps: 3,
    bevel: 0.5,
    tone: "hi",
    crease: "lo",
    owner,
    extra: Ln(k.planOutline(k.insetPlan(PLATE, 3), COOL_Z + 2.5, P, 3), { tone: "faint" }) + Ln(k.corners(PLATE, 4.4).map(([x, y]) => k.ring(x, y, 1.8, COOL_Z + 2.5, P, 10)).join(""), { tone: "lo" }) + Dots(k.corners(PLATE, 4.4).map(([x, y]) => at([x, y, COOL_Z + 2.5])), { size: 0.4 }),
  });
  slabPart("cooling", "pipe", { ...PIPE, x: PLATE.x + PLATE.w }, 12.8, 2.2, {
    steps: 3,
    bevel: 0.3,
    tone: "mid",
    owner,
    extra: Ln(k.lineOnTop([PLATE.x + PLATE.w + 4, PIPE.y + PIPE.d / 2], [PIPE.x + PIPE.w - 4, PIPE.y + PIPE.d / 2], 15, P), { tone: "faint" }),
  });
  const slots = [];
  for (let i = 1; i < 12; i++) slots.push(k.lineOnTop([STACK.x, STACK.y + i * (STACK.d / 12)], [STACK.x + STACK.w, STACK.y + i * (STACK.d / 12)], FAN.z + FAN.h, P));
  slabPart("cooling", "fins", STACK, FAN.z, FAN.h, { steps: 2, bevel: 0.3, tone: "mid", owner, extra: Ln(slots.join(""), { tone: "lo" }) });
  const bladeSvg = `<path class="lt-void" d="${k.onTop(Array.from({ length: 40 }, (_, i) => [FAN.x + Math.cos((i / 40) * Math.PI * 2) * 20.4, FAN.y + Math.sin((i / 40) * Math.PI * 2) * 20.4]), FAN.z + FAN.h, P, true)}"/>`;
  cylPart("cooling", "fan", FAN.x, FAN.y, FAN.r, FAN.z, FAN.h, {
    steps: 56,
    bevel: 0.6,
    tone: "mid",
    owner,
    extra: bladeSvg + Ln(k.ring(FAN.x, FAN.y, 21.6, FAN.z + FAN.h, P, 48) + k.ring(FAN.x, FAN.y, 20.4, FAN.z + FAN.h, P, 48), { tone: "lo" }) + `<g data-fan>${Ln(fanBlades(0), { tone: "mid" })}</g>` + Dots(k.corners({ x: FAN.x - 20, y: FAN.y - 20, w: 40, d: 40 }, 0.5).map(([x, y]) => at([x, y, FAN.z + FAN.h])), { size: 0.4 }),
  });
  cylPart("cooling", "hub", FAN.x, FAN.y, 5.4, FAN.z + FAN.h, 1.4, { tone: "hi", steps: 20, bevel: 0.3, owner, crease: "lo", extra: Ln(k.ring(FAN.x, FAN.y, 2.2, FAN.z + FAN.h + 1.4, P, 12), { tone: "lo" }) });
}

function ram() {
  [[-80, "a"], [-52, "b"]].forEach(([y, tag]) => {
    const pcb = { x: -130, y, w: 66, d: 20, r: 1 };
    slabPart("ram", `module-${tag}`, pcb, 11.5, 1.4, {
      steps: 2,
      tone: "mid",
      extra: Dots([-126, -122].map((x) => at([x, y + 17, 12.9])), { size: 0.4 }) + Ln(k.lineOnTop([-130, y + 3], [-64, y + 3], 12.9, P), { tone: "faint" }),
    });
    for (let i = 0; i < 4; i++) slabPart("ram", `chip-${tag}`, { x: -124 + i * 15.2, y: y + 5, w: 11.5, d: 13, r: 0.8 }, 12.9, 1.2, { steps: 2, tone: "hi", crease: "lo", extra: Dots([at([-122 + i * 15.2, y + 7, 14.1])], { size: 0.35 }) });
  });
}

function ssd() {
  const stick = { x: -130, y: -24, w: 70, d: 18, r: 1 };
  slabPart("ssd", "stick", stick, 11.5, 1.4, { steps: 2, tone: "mid", extra: Ln(k.lineOnTop([-130, -21], [-60, -21], 12.9, P), { tone: "faint" }) });
  for (let i = 0; i < 3; i++) slabPart("ssd", "chip", { x: -122 + i * 19, y: -20, w: 14, d: 11, r: 0.8 }, 12.9, 1.2, { steps: 2, tone: "hi", crease: "lo", extra: Dots([at([-119 + i * 19, -18, 14.1])], { size: 0.35 }) });
  cylPart("ssd", "screw", -63, -15, 2.2, 12.9, 1.2, { tone: "hi", steps: 12, crease: "none", extra: Ln(k.lineOnTop([-64.5, -15], [-61.5, -15], 14.1, P), { tone: "lo" }) });
}

const DECK_PLAN = BASE;
const U = 18.6;
const KEY_ROWS = [
  { y: -76, d: 9.4, h: 2.6, keys: Array(14).fill(1) },
  { y: -62.2, d: 15.8, h: 3.8, keys: [...Array(12).fill(1), 2] },
  { y: -43.6, d: 15.8, h: 3.8, keys: [1.5, ...Array(11).fill(1), 1.5] },
  { y: -25, d: 15.8, h: 3.8, keys: [1.75, ...Array(10).fill(1), 2.25] },
  { y: -6.4, d: 15.8, h: 3.8, keys: [2.25, ...Array(10).fill(1), 1.75] },
  { y: 12.2, d: 15.8, h: 3.8, keys: [1.25, 1.25, 1.25, 6.25, 1, 1, 1, 1] },
];
const KEY_X0 = -(14 * U) / 2;
function deck() {
  const top = DECK_Z1;
  const keyboardWell = { x: KEY_X0 - 4, y: -80, w: 14 * U + 8, d: 112, r: 4 };
  slabPart("deck", "plate", DECK_PLAN, DECK_Z0, DECK_Z1 - DECK_Z0, {
    steps: 3,
    bevel: 0.8,
    tone: "mid",
    inner: k.sideSeam(DECK_PLAN, DECK_Z0 + 1.5, P, 3),
    extra:
      Ln(k.planOutline(keyboardWell, top, P, 4), { tone: "lo" }) +
      Dots(k.dotGrid(-146, -60, 2, 20, 3.8, top, P), { size: 0.4, tone: "lo" }) +
      Dots(k.dotGrid(140, -60, 2, 20, 3.8, top, P), { size: 0.4, tone: "lo" }) +
      Dots(k.corners(DECK_PLAN, 5).map(([x, y]) => at([x, y, top])), { size: 0.45 }),
  });
  const cover = { x: -150, y: -95, w: 300, d: 14, r: 2 };
  slabPart("deck", "hinge-cover", cover, top, 3, {
    steps: 3,
    bevel: 0.5,
    tone: "mid",
    extra: Ln([-105, 105].map((x) => k.planOutline({ x: x - 22, y: -92, w: 44, d: 8, r: 2 }, top + 3, P, 3)).join(""), { tone: "lo" }) + Dots([at([-140, -88, top + 3]), at([140, -88, top + 3])], { size: 0.45 }),
  });
  KEY_ROWS.forEach((row, index) => {
    let x = KEY_X0;
    const svg = [];
    row.keys.forEach((units, i) => {
      const w = units * U - 2.4;
      const plan = { x: x + 1.2, y: row.y, w, d: row.d, r: 1.6 };
      const power = index === 0 && i === row.keys.length - 1;
      svg.push(S(k.slabOf(plan, top, row.h, P, 2, 0.3), { tone: power ? "hi" : "mid", crease: "lo" }));
      x += units * U;
    });
    const id = R.nameFor("deck.keys");
    const x1 = KEY_X0 + row.keys.reduce((a, b) => a + b, 0) * U;
    put("deck", [(KEY_X0 + x1) / 2, row.y + row.d / 2, top + row.h / 2], svg.join(""), { name: id, shapes: [R.solid(A.box([KEY_X0 + 1.2, row.y, top], [x1 - 1.2, row.y + row.d, top + row.h], { name: id }))] });
  });
  const pad = { x: -52, y: 42, w: 104, d: 44, r: 4 };
  slabPart("deck", "trackpad", pad, top, 0.6, { steps: 4, tone: "lo", crease: "none", extra: Ln(k.planOutline(k.insetPlan(pad, 2), top + 0.6, P, 4), { tone: "faint" }) });
}

const SCR = { x0: -139, x1: 139, z0: 53, z1: 205 };
function lid() {
  const owner = "lid";
  const backPlan = { x: -150, y: LID_Y, w: 300, d: 3.2, r: 1.5 };
  slabPart("lid", "cover", backPlan, LID_Z0, LID_H, { steps: 3, bevel: 0.6, tone: "mid", owner });
  slabPart("lid", "panel", { x: -146, y: LID_Y + 3.2, w: 292, d: 2, r: 1.5 }, LID_Z0 + 4, LID_H - 8, { steps: 3, tone: "lo", owner, crease: "none" });
  const glassY = LID_Y + 5.2;
  const glass = { x: -148, y: glassY, w: 296, d: 1.2, r: 2 };
  const faceY = glassY + 1.2;
  const id = "scr";
  const clip = `<clipPath id="lt-screen"><path transform="${planeOf(faceY)}" d="${flat(SCR.x0, SCR.z0, SCR.x1, SCR.z1, 4)}"/></clipPath>`;
  const ui = [];
  const wall = [];
  for (let x = -134; x <= 76; x += 20) wall.push(`M${x} ${-SCR.z0}L${x + 60} ${-SCR.z1}`);
  ui.push(`<path class="iso-line" data-tone="faint" d="${wall.join("")}"/>`);
  ui.push(`<path class="iso-line" data-tone="lo" d="M${SCR.x0} ${-(SCR.z1 - 10)}H${SCR.x1}"/>`);
  ui.push(`<path class="lt-dotpx" d="${[-132, -124, -116].map((x) => `M${x} ${-(SCR.z1 - 5)}h.01`).join("")}"/>`);
  ui.push(`<path class="iso-line" data-tone="lo" data-free d="M110 ${-(SCR.z1 - 5)}h22"/>`);
  ui.push(`<path class="lt-win" d="${flat(-100, 100, 20, 186, 5)}"/><path class="iso-line" data-tone="mid" d="${flat(-100, 100, 20, 186, 5)}"/>`);
  ui.push(`<path class="iso-line" data-tone="mid" d="M-100 ${-170}H20"/>`);
  ui.push(`<path class="lt-dotpx" d="${[-92, -84, -76].map((x) => `M${x} ${-178}h.01`).join("")}"/>`);
  ui.push(`<path class="iso-line" data-tone="lo" data-free d="M-90 -154h70M-90 -140h86M-90 -126h54M-90 -112h76"/>`);
  ui.push(`<path class="lt-win" d="${flat(40, 118, 122, 176, 5)}"/><path class="iso-line" data-tone="mid" d="${flat(40, 118, 122, 176, 5)}"/>`);
  ui.push(`<path class="iso-line" data-tone="lo" data-free d="M48 -160h56M48 -148h38M48 -136h48"/>`);
  ui.push(`<path class="lt-win" d="${flat(-54, 58, 54, 70, 8)}"/><path class="iso-line" data-tone="mid" d="${flat(-54, 58, 54, 70, 8)}"/>`);
  ui.push(`<path class="iso-line" data-tone="lo" d="${[-38, -22, -6, 10, 26, 42].map((x) => flat(x - 4, 61, x + 4, 67, 1.6)).join("")}"/>`);
  const screen =
    clip +
    `<g data-screen><g clip-path="url(#lt-screen)"><g transform="${planeOf(faceY)}"><path class="lt-screen" d="${flat(SCR.x0, SCR.z0, SCR.x1, SCR.z1, 4)}"/>${ui.join("")}</g></g>` +
    `<g transform="${planeOf(faceY)}"><path class="iso-line" data-tone="lo" d="${flat(SCR.x0, SCR.z0, SCR.x1, SCR.z1, 4)}"/><path class="lt-dotpx" d="M0 ${-(SCR.z1 + 5)}h.01"/></g></g>`;
  slabPart("lid", "glass", glass, LID_Z0 + 2, LID_H - 4, { steps: 3, bevel: 0.4, tone: "hi", owner, crease: "lo", extra: screen });
  for (const x of [-100, 100]) {
    const F = G.frameOf([x, HINGE_Y, 34], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    const bid = R.nameFor("lid.hinge");
    put("lid", [x, HINGE_Y, 34], S(G.disc(-16, 16, 6, F, P), { tone: "mid" }) + Ln([-10, 10].map((s) => G.arcOf(F, s, 6, P)).join(""), { tone: "faint" }), {
      name: bid,
      shapes: [R.solid(A.disc(F, -16, 16, 6, { name: bid, owner }))],
    });
  }
}

tray();
battery();
board();
cpu();
cooling();
ram();
ssd();
deck();
lid();

const FAST = process.argv.includes("--fast");
A.settle(R, P, FAST ? { states: [...A.uniformStates(10), ...A.prefixStates(STAGGER)] } : {});
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}" data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const camPoints = [...k.boxCorners(BASE, -3, 30), ...k.boxCorners({ x: -150, y: LID_Y, w: 300, d: 8 }, LID_Z0 - 12, LID_Z0 + LID_H)].map(at);
const cx0 = Math.min(...camPoints.map((p) => p[0]));
const cx1 = Math.max(...camPoints.map((p) => p[0]));
const cy0 = Math.min(...camPoints.map((p) => p[1]));
const cy1 = Math.max(...camPoints.map((p) => p[1]));
const camW = Math.max((cx1 - cx0) * 1.12, ((cy1 - cy0) * 1.14 * W) / H);
const camH = (camW * H) / W;
const TIGHT = [(cx0 + cx1) / 2 - camW / 2, (cy0 + cy1) / 2 - camH / 2, camW, camH];
const DATA = {
  cam: { full: [0, 0, W, H], tight: TIGHT },
  W,
  H,
  P,
  V,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  fan: { x: FAN.x, y: FAN.y, z: FAN.z + FAN.h + 0.1 },
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, piece]) => [id, { name: piece.name, say: piece.say, desc: piece.desc }])),
  stagger: STAGGER,
  spring: SPRING,
  order: ORDER,
};

const LABEL =
  "Un ordinateur portable ouvert, vu en éclaté. De bas en haut : la coque inférieure sur quatre pieds, la batterie, la carte mère avec ses ports, le processeur, deux barrettes de mémoire vive, un SSD, le bloc de refroidissement avec son ventilateur, la coque supérieure avec le clavier et le pavé tactile, et l'écran avec ses charnières. On peut les monter un par un pour obtenir la machine complète.";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg lt-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${LABEL}"><g class="lt-parts">${groups.join("")}</g></svg>`;

const PARTS = ORDER.map((id, index) => `<button type="button" class="lt-part" data-part="${id}"><span class="lt-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Laptop · vue éclatée</span><span class="iso-plate-corner" data-corner="readout" data-readout>éclaté · 9 composants</span></div>`;
const stage = `<div class="lt-stage" tabindex="0" role="slider" aria-label="Ordinateur portable en vue éclatée. Survolez une pièce ou utilisez les flèches pour la découvrir, Espace pour monter ou démonter la machine, Échap pour désélectionner." aria-valuemin="0" aria-valuemax="9" aria-valuenow="0" aria-valuetext="éclaté">${svg}</div>`;
const controls = `<div class="lt-controls"><button type="button" class="lt-go" data-go><span class="lt-lamp" aria-hidden="true"></span><span data-go-label>Monter</span></button><span class="lt-hint">Survolez une pièce pour la découvrir</span></div>`;
const caption =
  "Un ordinateur portable se monte par couches. Le châssis reçoit la batterie et la carte mère ; sur la carte viennent le processeur, la mémoire, le stockage et le refroidissement ; la coque supérieure referme le tout, et l'écran se fixe à l'arrière par ses charnières.";
const body = `<figure class="iso-figure lt"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend"><span class="lt-parts-list">${PARTS}</span><span class="lt-desc" data-desc aria-live="polite">${caption}</span></figcaption><span class="lt-live" data-live aria-live="polite"></span></figure>`;

const CSS = readFileSync(join(HERE, "laptop.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA)).replace("__CAPTION__", JSON.stringify(caption));
const page = k.pageHtml({ title: "Laptop · vue éclatée", theme: THEME, body: `<style>${CSS}</style>${body}`, script: kitScript() + LIVE, width: 860 }).replace('lang="en"', 'lang="fr"');
const name = THEME === "light" ? "laptop-light.html" : "laptop.html";
writeFileSync(join(HERE, "..", "..", "docs", name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} items`);

A.auditOrExit(R, P, {});
