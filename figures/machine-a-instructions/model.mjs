export const PROGRAM = [[0, 3], [1, 4], [1, 5], [2, 2], [3, 0]];
export const OPNAME = ["CHARGER", "AJOUTER", "RETIRER", "ÉCRIRE"];
export const PHASES = ["chercher", "décoder", "exécuter"];
export const CYCLE = 6;
export const ACC_AFTER = [3, 7, 12, 10, 10];

export const CELL_Y = -84;
export const CELL_D = 30;
export const CELL_W = 24;
export const CELL_PITCH = 30;
export const CELL_TOP = 22;
export const cellX = (i) => -144 + CELL_PITCH * i;
export const cellCentre = (i) => cellX(i) + CELL_W / 2;

export const PROBE_Y = -69;
export const PAD_R = 7;
export const PAD_Z = 29.5;
export const PAD_H = 2.6;
export const LIFT = 8;
export const SEL_X = (op) => 52 + 22 * op;
export const SEL_PLAN = { w: 18, y: -86.5, d: 34 };
export const SEL_Z = 16;
export const PHASE_X = (p) => -75 + 19 * p;
export const PHASE_Y = 78;
export const FLY = [-118, 50];
export const FLY_R = 22;
export const FLY_Z = 16;
export const FLY_TOP = 21;
export const DIAL = [-40, 50];
export const DIAL_R = 17;
export const DIAL_TOP = 12;
export const ACC_FRONT = 66;
export const ACC_WIN = { acc: [44, 84], out: [92, 132], z0: 8, z1: 24 };
export const JACK_CAR = [0, -14, 11.5];

const smooth = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const pad = (n) => String(Math.max(0, Math.min(99, Math.round(n)))).padStart(2, "0");

export function stateAt(clock) {
  const n = Math.max(0, Math.floor(clock / CYCLE));
  const tt = clock - n * CYCLE;
  const pc = n % PROGRAM.length;
  const prev = (pc + PROGRAM.length - 1) % PROGRAM.length;
  const [op, operand] = PROGRAM[pc];
  const [prevOp, prevOperand] = PROGRAM[prev];
  const first = n === 0;
  const accBefore = first ? 0 : ACC_AFTER[(n - 1) % PROGRAM.length];
  const outBefore = n < PROGRAM.length ? 0 : ACC_AFTER[PROGRAM.length - 1];
  const accAfter = ACC_AFTER[pc];

  const cx = first ? cellCentre(pc) : lerp(cellCentre(prev), cellCentre(pc), smooth((tt - 0.05) / 1.1));
  const down = smooth((tt - 1.1) / 0.5) - smooth((tt - 2.1) / 0.5);
  const dz = LIFT * (1 - down);
  const selFrom = first ? SEL_X(op) : SEL_X(prevOp);
  const sel = lerp(selFrom, SEL_X(op), smooth((tt - 2.2) / 1.2));
  const needleFrom = first ? 0 : prevOperand;
  const dial = lerp(needleFrom, operand, smooth((tt - 2.4) / 1.2));
  const run = smooth((tt - 4.2) / 1.1);
  const acc = op === 3 ? accBefore : lerp(accBefore, accAfter, run);
  const out = op === 3 ? lerp(outBefore, accAfter, run) : outBefore;

  const p = tt < 2 ? 0 : tt < 4 ? 1 : 2;
  let slider;
  if (tt < 0.35) slider = first ? 0 : 2 * (1 - smooth(tt / 0.35));
  else if (tt < 1.9) slider = 0;
  else if (tt < 2.3) slider = smooth((tt - 1.9) / 0.4);
  else if (tt < 3.9) slider = 1;
  else if (tt < 4.3) slider = 1 + smooth((tt - 3.9) / 0.4);
  else slider = 2;
  const fly = ((p + smooth((tt % 2) / 2)) / 3) * Math.PI * 2;

  const sign = op === 1 ? "+" : "−";
  let readout;
  if (p === 0) readout = `${PHASES[0]} · cellule ${pc + 1}/${PROGRAM.length}`;
  else if (p === 1) readout = `${PHASES[1]} · ${OPNAME[op]}${op === 3 ? "" : " " + operand}`;
  else if (op === 0) readout = `${PHASES[2]} · acc = ${operand}`;
  else if (op === 3) readout = `${PHASES[2]} · sortie ← ${pad(accAfter)}`;
  else readout = `${PHASES[2]} · ${pad(accBefore)} ${sign} ${operand} = ${pad(accAfter)}`;

  return { n, tt, pc, op, operand, phase: p, cx, dz, sel, dial, acc, out, slider, fly, readout, down };
}

export function flywheelSvg(k, P, angle) {
  const [x, y] = FLY;
  const S = (paths, style) => k.solidSvg(paths, style);
  const ticks = k.radialTicks(x, y, FLY_R - 2.2, 48, 4, FLY_TOP, [1.2, 2.6], P, angle);
  const spokes = [0, 1, 2]
    .map((i) => {
      const a = angle + (i * Math.PI * 2) / 3;
      return k.lineOnTop([x + Math.sin(a) * 3.4, y - Math.cos(a) * 3.4], [x + Math.sin(a) * (FLY_R - 2.2), y - Math.cos(a) * (FLY_R - 2.2)], FLY_TOP, P);
    })
    .join("");
  const wa = angle + 0.4;
  const wx = x + Math.sin(wa) * 15;
  const wy = y - Math.cos(wa) * 15;
  return [
    k.lineSvg(ticks.minor, { tone: "lo" }),
    k.lineSvg(ticks.major, { tone: "mid" }),
    k.lineSvg(spokes, { tone: "mid" }),
    S(k.cylinder(wx, wy, 3.4, FLY_TOP, 3.6, P, 16), { tone: "mid" }),
    k.dotsSvg([k.iso([wx, wy, FLY_TOP + 3.6], P)], { size: 0.5 }),
  ].join("");
}

export function needleD(k, P, value) {
  const angle = (value / 10) * Math.PI * 2;
  const [x, y] = DIAL;
  return k.lineOnTop(
    [x - Math.sin(angle) * 3.4, y + Math.cos(angle) * 3.4],
    [x + Math.sin(angle) * (DIAL_R - 4), y - Math.cos(angle) * (DIAL_R - 4)],
    DIAL_TOP + 0.2,
    P,
  );
}

export function wireOne(k, P, cx) {
  const at = (p) => k.iso(p, P);
  return k.wireSvg(at([cx, JACK_CAR[1], JACK_CAR[2]]), at([44, -44, 7]), {
    via: [at([cx, -6, 0.6]), at([44, -6, 0.6]), at([44, -44, 0.6])],
    tone: "mid",
    size: 1.1,
  });
}

export function wireTwo(k, P) {
  const at = (p) => k.iso(p, P);
  return k.wireSvg(at([134, -52, 6]), at([140, 36, 6]), {
    via: [at([150, -52, 6]), at([150, -52, 0.6]), at([150, 36, 0.6]), at([150, 36, 6])],
    tone: "mid",
    size: 1.1,
  });
}

export const SPRING = { y: -28.5, z: 3, r: 3, turns: 12, anchor: 22, free: 76 };
export function springParts(k, P, cx) {
  const end = Math.max(SPRING.anchor - SPRING.free, cx + 17);
  const c = k.coil(end, SPRING.anchor, [SPRING.y, SPRING.z], SPRING.r, SPRING.turns, "x", P);
  const seat = k.solidSvg(k.slabOf({ x: end - 1.8, y: SPRING.y - 3, w: 1.8, d: 6, r: 0.6 }, 0, 6, P, 2, 0.2), { tone: "mid", crease: "none" });
  return { back: seat + k.lineSvg(c.back, { tone: "lo" }), front: k.lineSvg(c.front, { tone: "mid" }) };
}

export function wireThree(k, P) {
  const at = (p) => k.iso(p, P);
  return k.wireSvg(at([64, -44, 7]), at([-20, 50, 2]), {
    via: [at([64, -44, 0.6]), at([64, -1, 0.6]), at([-8, -1, 0.6]), at([-8, 50, 0.6]), at([-8, 50, 2])],
    tone: "mid",
    size: 1.1,
  });
}
