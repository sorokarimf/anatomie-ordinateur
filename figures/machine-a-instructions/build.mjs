import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 660;
const HEIGHT = 410;

const PLATE = { x: -176, y: -104, w: 352, d: 208, r: 10 };
const PLATE_H = 12;
const FOOT_H = 5;

const BED = { x: -150, y: -90, w: 164, d: 44, r: 3 };
const BED_TOP = 8;
const CELL_H = 14;
const RAIL_Y = [-40, -18];
const CAR = { x: -17, y: -44, w: 34, d: 30, r: 3 };
const ARM = { x: -7, y: -78, w: 14, d: 46, r: 2.5 };
const ARM_Z = 44;
const ARM_H = 5;
const SLEEVE_R = 5.5;
const SLEEVE_TOP = 60;

const DECODER = { x: 38, y: -92, w: 96, d: 48, r: 4 };
const DEC_TOP = 16;
const ACC = { x: 34, y: 6, w: 106, d: 60, r: 5 };
const ACC_TOP = 30;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [0, M.PROBE_Y, SLEEVE_TOP + 2], [M.FLY[0], M.FLY[1], 30], [100, 36, ACC_TOP + 6]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const planeOf = (y) => k.sideMatrix([0, y], 0, P, "left");
const flat = (x0, z0, x1, z1, r, steps = 5) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([u, z]) => [u, -z]), true);

let clips = 0;
function recess({ x0, x1, z0, z1, r, depth }, y, back = "") {
  const id = `mi-clip-${clips++}`;
  const ring = k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, 5);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const { sinA } = k.cameraOf(P);
  const tops = [];
  const sides = [[], [], [], []];
  ring.forEach(([ax, az], index) => {
    const [bx, bz] = ring[(index + 1) % ring.length];
    const length = Math.hypot(bx - ax, bz - az) || 1;
    let [nx, nz] = [(bz - az) / length, -(bx - ax) / length];
    if (nx * (cx - (ax + bx) / 2) + nz * (cz - (az + bz) / 2) < 0) [nx, nz] = [-nx, -nz];
    if (nx <= 0 && nz <= 0) return;
    const quad = k.pathOf([at([ax, y, az]), at([bx, y, bz]), at([bx, y - depth, bz]), at([ax, y - depth, az])], true);
    if (nz >= nx) tops.push(quad);
    else sides[Math.min(3, Math.max(0, Math.floor(((nx * -sinA + 1) / 2) * 4)))].push(quad);
  });
  const shape = flat(x0, z0, x1, z1, r);
  return [
    `<clipPath id="${id}"><path transform="${planeOf(y)}" d="${shape}"/></clipPath>`,
    `<g clip-path="url(#${id})">`,
    `<path class="iso-top" d="${tops.join("")}"/>`,
    ...sides.map((d, shade) => (d.length ? `<path class="iso-shade" data-shade="${shade}" d="${d.join("")}"/>` : "")),
    `<g transform="${planeOf(y - depth)}"><path class="mi-well" d="${shape}"/>${back}<path class="iso-line" data-tone="faint" d="${shape}"/></g>`,
    `</g>`,
    `<g transform="${planeOf(y)}"><path class="iso-line" data-tone="lo" d="${shape}"/></g>`,
  ].join("");
}

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const label = { x: 104, y: 80, w: 48, d: 16, r: 1.6 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(L([32, 24, 28].map((w, i) => k.lineOnTop([label.x + 6, label.y + 4.5 + i * 3.4], [label.x + 6 + w, label.y + 4.5 + i * 3.4], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + label.w - 4, label.y + 4.5, 0.8]), at([label.x + label.w - 4, label.y + label.d - 4.5, 0.8])], { size: 0.45 }));
  const back = { x: -150, y: -99.5, w: 300, d: 5, r: 0.8 };
  out.push(S(k.slabOf(back, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const rule = k.topTicks(back.x + 3, back.x + back.w - 3, 5, 6, back.y + 0.6, 0.6, [1.6, 3], P);
  out.push(L(rule.minor, { tone: "lo" }), L(rule.major, { tone: "mid" }));
  out.push(D([at([back.x + 1.5, back.y + 2.5, 0.6]), at([back.x + back.w - 1.5, back.y + 2.5, 0.6])], { size: 0.4 }));
  const left = { x: -166, y: 84, w: 52, d: 12, r: 1.6 };
  out.push(S(k.slabOf(left, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(left, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(L([34, 22].map((w, i) => k.lineOnTop([left.x + 6, left.y + 4 + i * 3.6], [left.x + 6 + w, left.y + 4 + i * 3.6], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([left.x + left.w - 4, left.y + left.d / 2, 0.8])], { size: 0.45 }));
  return out.join("");
}

function reset() {
  const out = [];
  const box = { x: -172, y: -98, w: 20, d: 22, r: 3 };
  out.push(`<path class="iso-halo" d="${k.haloOf(box, 0, 8, P)}" style="filter:blur(5px)"/>`);
  out.push(S(k.slabOf(box, 0, 8, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(box, 2.2), 8, P, 4), { tone: "faint" }));
  out.push(D(k.corners(box, 4).map(([x, y]) => at([x, y, 8])), { size: 0.4 }));
  const c = [box.x + 10, box.y + 11];
  out.push(L(k.ring(c[0], c[1], 7.2, 8, P, 28), { tone: "lo" }));
  out.push(S(k.cylinder(c[0], c[1], 6, 8, 4.5, P, 28, 0.5), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(c[0], c[1], 3.6, 12.5, P, 20), { tone: "lo" }));
  return out.join("");
}

function supply() {
  const out = [];
  const box = { x: 142, y: -98, w: 28, d: 32, r: 3 };
  out.push(`<path class="iso-halo" d="${k.haloOf(box, 0, 10, P)}" style="filter:blur(6px)"/>`);
  out.push(S(k.slabOf(box, 0, 22, P, 4, 0.7), { tone: "mid" }));
  out.push(L(k.sideSeam(box, 6, P, 4), { tone: "faint" }));
  out.push(L(k.planOutline(k.insetPlan(box, 2.4), 22, P, 4), { tone: "faint" }));
  for (let i = 0; i < 5; i++) out.push(L(k.planOutline({ x: box.x + 5 + i * 4, y: box.y + 14, w: 1.8, d: 13, r: 0.9 }, 22, P, 2), { tone: "lo" }));
  out.push(D(k.corners(box, 5).map(([x, y]) => at([x, y, 22])), { size: 0.4 }));
  const t = [box.x + 14, box.y + 7];
  out.push(S(k.cylinder(t[0], t[1], 3.2, 22, 2, P, 18), { tone: "lo" }));
  out.push(S(k.cylinder(t[0], t[1], 1.2, 24, 6, P, 12), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(t[0], t[1], 2.1, 30, 2.4, P, 14), { tone: "hi" }));
  return out.join("");
}

function rack() {
  const out = [];
  out.push(S(k.slabOf(BED, 0, BED_TOP, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BED, 3), BED_TOP, P, 4), { tone: "faint" }));
  const strip = { x: -146, y: BED.y + BED.d - 5.5, w: 156, d: 4.5, r: 0.8 };
  out.push(S(k.slabOf(strip, BED_TOP, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 3, 10, strip.y + 0.6, BED_TOP + 0.6, [1.6, 3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 1, strip.y + strip.d / 2, BED_TOP + 0.6]), at([strip.x + strip.w - 1, strip.y + strip.d / 2, BED_TOP + 0.6])], { size: 0.4 }));
  out.push(D([at([BED.x + 5, BED.y + 5, BED_TOP]), at([BED.x + BED.w - 5, BED.y + 5, BED_TOP])], { size: 0.45 }));

  M.PROGRAM.forEach(([op, operand], i) => {
    const plan = { x: M.cellX(i), y: M.CELL_Y, w: M.CELL_W, d: M.CELL_D, r: 2 };
    const cx = M.cellCentre(i);
    out.push(S(k.slabOf(plan, BED_TOP, CELL_H, P, 3, 0.5), { tone: "hi", crease: "lo" }));
    out.push(L(k.planOutline(k.insetPlan(plan, 2.2), M.CELL_TOP, P, 3), { tone: "faint" }));
    [[-5.5, op >> 1], [5.5, op & 1]].forEach(([dx, bit]) => {
      const px = cx + dx;
      const py = -75;
      if (bit) {
        out.push(S(k.cylinder(px, py, 2.4, M.CELL_TOP, 6, P, 16), { tone: "mid" }));
        out.push(D([at([px, py, M.CELL_TOP + 6])], { size: 0.45 }));
      } else {
        out.push(L(k.ring(px, py, 2.4, M.CELL_TOP, P, 14), { tone: "lo" }));
        out.push(D([at([px, py, M.CELL_TOP])], { size: 0.4, tone: "lo" }));
      }
    });
    for (let j = 0; j < operand; j++) {
      const px = cx - 8 + 4 * j;
      out.push(S(k.cylinder(px, -62, 1.5, M.CELL_TOP, 2.4, P, 10), { tone: "lo" }));
    }
    for (let j = operand; j < 5; j++) out.push(L(k.ring(cx - 8 + 4 * j, -62, 1.2, M.CELL_TOP, P, 8), { tone: "faint" }));
  });
  return out.join("");
}

function rails() {
  const out = [];
  for (const y of RAIL_Y) {
    out.push(S(k.slabOf({ x: -158, y: y - 2.5, w: 180, d: 5, r: 1 }, 0, 3, P, 3, 0.4), { tone: "mid" }));
    out.push(D([-150, 14].map((x) => at([x, y, 3])), { size: 0.4 }));
  }
  for (const x of [-164, 22]) {
    out.push(S(k.slabOf({ x, y: -46, w: 5, d: 32, r: 1.2 }, 0, 8, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([x + 2.5, -40, 8]), at([x + 2.5, -22, 8])], { size: 0.45 }));
  }
  return out.join("");
}

function decoder() {
  const out = [];
  out.push(S(k.slabOf(DECODER, 0, DEC_TOP, P, 5, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(DECODER, 3), DEC_TOP, P, 5), { tone: "faint" }));
  for (let i = 0; i < 4; i++) {
    const cx = M.SEL_X(i);
    out.push(L(k.planOutline({ x: cx - 7, y: -86, w: 14, d: 34, r: 2 }, DEC_TOP, P, 3), { tone: "lo" }));
    const pips = [];
    for (let j = 0; j <= i; j++) pips.push(at([cx + (j - i / 2) * 3.4, -48, DEC_TOP]));
    out.push(D(pips, { size: 0.5, tone: "hi" }));
  }
  for (const y of [-89.8, -51.2]) {
    out.push(S(k.slabOf({ x: 42, y: y - 1.2, w: 88, d: 2.4, r: 0.6 }, DEC_TOP, 3, P, 2, 0.3), { tone: "lo", crease: "none" }));
  }
  const screws = k.corners(DECODER, 6);
  out.push(D(screws.map(([x, y]) => at([x, y, DEC_TOP])), { size: 0.45 }));
  const jack = [DECODER.x + DECODER.w, -52];
  out.push(L(k.sideRing([jack[0], jack[1], 6], 3, "y", P, 14), { tone: "lo" }));
  const jackF = [44, DECODER.y + DECODER.d];
  out.push(L(k.sideRing([jackF[0], jackF[1], 7], 2.6, "x", P, 14), { tone: "lo" }));
  out.push(L(k.sideRing([64, jackF[1], 7], 2.6, "x", P, 14), { tone: "lo" }));
  return out.join("");
}

function selector() {
  const out = [];
  const plan = { x: -M.SEL_PLAN.w / 2, y: M.SEL_PLAN.y, w: M.SEL_PLAN.w, d: M.SEL_PLAN.d, r: 2 };
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, 3), M.SEL_Z, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(plan, M.SEL_Z, 5, P, 4, 0.5), { tone: "mid" }));
  out.push(L(k.lineOnTop([plan.x, -78], [plan.x + plan.w, -78], M.SEL_Z + 5, P), { tone: "faint" }));
  out.push(L(k.lineOnTop([plan.x, -58], [plan.x + plan.w, -58], M.SEL_Z + 5, P), { tone: "faint" }));
  out.push(S(k.cylinder(0, -68, 3.2, M.SEL_Z + 5, 4, P, 20), { tone: "hi" }));
  out.push(L(k.knurl(0, -68, 3.2, M.SEL_Z + 5, M.SEL_Z + 9, 20, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([0, -68], [3.2, -68], M.SEL_Z + 9, P), { tone: "hi" }));
  out.push(D([at([0, -68, M.SEL_Z + 9])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

function carriage() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CAR, 3), 9, 0.1, P)}" style="filter:blur(4px)"/>`];
  for (const y of RAIL_Y) {
    for (const x of [-9, 9]) out.push(S(k.slabOf({ x: x - 4, y: y - 4.5, w: 8, d: 9, r: 1.2 }, 3, 6, P, 3, 0.4), { tone: "lo" }));
  }
  out.push(S(k.slabOf(CAR, 9, 5, P, 5, 0.6), { tone: "mid" }));
  out.push(D([[-13, -40], [13, -40], [-13, -18], [13, -18]].map(([x, y]) => at([x, y, 14])), { size: 0.45 }));
  out.push(L(k.lineOnTop([CAR.x, -34], [CAR.x + CAR.w, -34], 14, P), { tone: "faint" }));
  out.push(L(k.lineOnTop([CAR.x, -24], [CAR.x + CAR.w, -24], 14, P), { tone: "faint" }));
  const post = { x: -5, y: -42, w: 10, d: 10, r: 1.6 };
  out.push(S(k.slabOf(post, 14, ARM_Z - 14, P, 3, 0.4), { tone: "mid", inner: L([22, 34].map((z) => k.sideSeam(post, z, P, 3)).join(""), { tone: "faint" }) }));
  out.push(S(k.slabOf(ARM, ARM_Z, ARM_H, P, 4, 0.5), { tone: "mid" }));
  out.push(L(k.lineOnTop([-7, -50], [7, -50], ARM_Z + ARM_H, P), { tone: "faint" }));
  out.push(D([at([0, -36, ARM_Z + ARM_H]), at([0, -50, ARM_Z + ARM_H])], { size: 0.45 }));
  out.push(S(k.cylinder(0, M.PROBE_Y, 5.5, ARM_Z + ARM_H, SLEEVE_TOP - ARM_Z - ARM_H, P, 24), { tone: "mid", crease: "none" }));
  out.push(L([52, 56].map((z) => k.sideArc(0, M.PROBE_Y, 5.5, z, P, 14)).join(""), { tone: "faint" }));
  out.push(S(k.cylinder(0, M.PROBE_Y, 6.4, SLEEVE_TOP, 2.4, P, 24, 0.4), { tone: "mid" }));
  out.push(L(k.ring(0, M.PROBE_Y, 3.4, SLEEVE_TOP + 2.4, P, 14), { tone: "lo" }));
  const handle = [8, CAR.y + CAR.d + 3];
  out.push(S(k.slabOf({ x: handle[0] - 2, y: CAR.y + CAR.d - 1, w: 4, d: 4, r: 1 }, 10, 3, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(handle[0], handle[1] + 1, 3, 9, 5, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(handle[0], handle[1] + 1, 3, 9, 14, 18, P), { tone: "lo" }));
  const socket = [-6, CAR.y + CAR.d];
  out.push(L(k.sideRing([socket[0] - 3, socket[1], 11.5], 2.2, "x", P, 12), { tone: "lo" }));
  return out.join("");
}

function plunger() {
  const out = [];
  out.push(S(k.cylinder(0, M.PROBE_Y, 2.2, M.PAD_Z + M.PAD_H, 17.4, P, 16), { tone: "hi", crease: "none" }));
  out.push(S(k.cylinder(0, M.PROBE_Y, M.PAD_R, M.PAD_Z, M.PAD_H, P, 28, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(0, M.PROBE_Y, M.PAD_R - 2, M.PAD_Z + M.PAD_H, P, 20), { tone: "lo" }));
  out.push(D([at([0, M.PROBE_Y - 4.4, M.PAD_Z + M.PAD_H]), at([0, M.PROBE_Y + 4.4, M.PAD_Z + M.PAD_H])], { size: 0.4 }));
  return out.join("");
}

function clock() {
  const out = [];
  const [fx, fy] = M.FLY;
  const base = { x: fx - 28, y: fy - 28, w: 56, d: 56, r: 6 };
  out.push(`<path class="iso-halo" d="${k.haloOf(base, 0, 6, P)}" style="filter:blur(6px)"/>`);
  out.push(S(k.slabOf(base, 0, 6, P, 6, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(base, 3), 6, P, 6), { tone: "faint" }));
  out.push(D(k.corners(base, 6).map(([x, y]) => at([x, y, 6])), { size: 0.45 }));
  out.push(S(k.slabOf({ x: fx - 2.2, y: fy - 36, w: 4.4, d: 12, r: 1 }, 6, 22, P, 3, 0.3), { tone: "lo" }));
  out.push(S(k.cylinder(fx, fy, 4, 6, M.FLY_Z - 6, P, 20), { tone: "mid", crease: "none" }));
  out.push(L(k.sideArc(fx, fy, 4, 11, P, 12), { tone: "faint" }));
  out.push(S(k.cylinder(fx, fy, M.FLY_R, M.FLY_Z, M.FLY_TOP - M.FLY_Z, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(fx, fy, M.FLY_R - 2.2, M.FLY_TOP, P, 64), { tone: "lo" }));
  out.push(L(k.ring(fx, fy, 3.4, M.FLY_TOP, P, 16), { tone: "mid" }));
  out.push(`<g data-part="fly">${M.flywheelSvg(k, P, 0)}</g>`);
  out.push(S(k.cylinder(fx, fy, 2.2, M.FLY_TOP, 2, P, 14), { tone: "mid" }));
  return out.join("");
}

function phaseRail() {
  const out = [];
  const strip = { x: -86, y: M.PHASE_Y, w: 68, d: 12, r: 2 };
  out.push(S(k.slabOf(strip, 0, 2.4, P, 3, 0.4), { tone: "lo" }));
  for (let i = 0; i < 3; i++) {
    out.push(L(k.planOutline({ x: M.PHASE_X(i) - 7, y: strip.y + 2, w: 14, d: 8, r: 1.4 }, 2.4, P, 3), { tone: "faint" }));
    const pips = [];
    for (let j = 0; j <= i; j++) pips.push(at([M.PHASE_X(i) + (j - i / 2) * 3.2, strip.y + strip.d + 2.6, 0]));
    out.push(D(pips, { size: 0.5, tone: "hi" }));
  }
  out.push(D([at([strip.x + 2.2, strip.y + 6, 2.4]), at([strip.x + strip.w - 2.2, strip.y + 6, 2.4])], { size: 0.4 }));
  return out.join("");
}

function phaseSlider() {
  const plan = { x: -6, y: M.PHASE_Y + 2.5, w: 12, d: 7, r: 1.4 };
  return [
    S(k.slabOf(plan, 2.4, 3.6, P, 3, 0.4), { tone: "hi", lit: true }),
    L(k.lineOnTop([0, plan.y + 1.6], [0, plan.y + plan.d - 1.6], 6, P), { tone: "lit" }),
  ].join("");
}

function dial() {
  const out = [];
  const [x, y] = M.DIAL;
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: x - 20, y: y - 20, w: 40, d: 40, r: 20 }, 0, 4, P)}" style="filter:blur(5px)"/>`);
  out.push(S(k.cylinder(x, y, 20, 0, 4, P, 56, 0.6), { tone: "mid" }));
  out.push(L(k.ring(x, y, 17.4, 4, P, 56), { tone: "faint" }));
  out.push(S(k.cylinder(x, y, M.DIAL_R, 4, M.DIAL_TOP - 4, P, 56, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, M.DIAL_R, M.DIAL_TOP - 3, M.DIAL_TOP, 72, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, M.DIAL_R, M.DIAL_TOP - 3, P, 36), { tone: "faint" }));
  out.push(L(k.ring(x, y, M.DIAL_R - 2, M.DIAL_TOP, P, 56), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, M.DIAL_R - 2.8, 50, 5, M.DIAL_TOP, [1.2, 2.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  const screws = [0.8, 2.4, 4.0, 5.6].map((a) => at([x + Math.sin(a) * 18.7, y - Math.cos(a) * 18.7, 4]));
  out.push(D(screws, { size: 0.4 }));
  out.push(L(k.ring(x, y, 1.6, M.DIAL_TOP, P, 16), { tone: "mid" }));
  return out.join("");
}

function accumulator() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(ACC, 0, 8, P)}" style="filter:blur(6px)"/>`);
  out.push(S(k.slabOf(ACC, 0, ACC_TOP, P, 6, 0.9), { tone: "mid" }));
  out.push(L(k.sideSeam(ACC, 5, P, 6), { tone: "faint" }));
  out.push(L(k.planOutline(k.insetPlan(ACC, 3.5), ACC_TOP, P, 6), { tone: "faint" }));
  out.push(D(k.corners(ACC, 7).map(([x, y]) => at([x, y, ACC_TOP])), { size: 0.45 }));
  for (let i = 0; i < 4; i++) out.push(L(k.planOutline({ x: 44 + i * 8, y: 14, w: 3, d: 16, r: 1.5 }, ACC_TOP, P, 3), { tone: "lo" }));
  const knobs = [[112, 20], [112, 38]];
  for (const [kx, ky] of knobs) {
    out.push(S(k.cylinder(kx, ky, 5.4, ACC_TOP, 4, P, 28), { tone: "mid" }));
    out.push(L(k.knurl(kx, ky, 5.4, ACC_TOP, ACC_TOP + 4, 30, P), { tone: "lo" }));
    out.push(L(k.lineOnTop([kx, ky], [kx + 4.6, ky], ACC_TOP + 4, P), { tone: "hi" }));
  }
  const text = (key, x0, x1) => {
    const mid = (x0 + x1) / 2;
    const base = -(M.ACC_WIN.z0 + 4.2);
    return [
      `<path class="iso-line" data-tone="faint" d="M${mid} ${-M.ACC_WIN.z0}V${-M.ACC_WIN.z1}"/>`,
      `<text class="mi-digit" data-part="${key}-a" x="${(x0 + mid) / 2}" y="${base}" font-size="12" text-anchor="middle">0</text>`,
      `<text class="mi-digit" data-part="${key}-b" x="${(mid + x1) / 2}" y="${base}" font-size="12" text-anchor="middle">0</text>`,
    ].join("");
  };
  const y = ACC.y + ACC.d;
  for (const key of ["acc", "out"]) {
    const [x0, x1] = M.ACC_WIN[key];
    out.push(recess({ x0, x1, z0: M.ACC_WIN.z0, z1: M.ACC_WIN.z1, r: 3, depth: 3 }, y, text(key, x0, x1)));
  }
  const jack = [ACC.x + ACC.w, 36];
  out.push(L(k.sideRing([jack[0], jack[1], 6], 3, "y", P, 14), { tone: "lo" }));
  out.push(S(k.slabOf({ x: 40, y: y - 1, w: 94, d: 1, r: 0.4 }, 3, 1.4, P, 2), { tone: "lo", crease: "none" }));
  return out.join("");
}

const initial = M.stateAt(1.6);
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Une machine à instructions sur une plaque. Cinq cellules de programme portent des chevilles, une tête de lecture glisse sur deux rails et abaisse son palpeur sur la cellule, un sélecteur se place sur l'une des quatre encoches du décodeur, un cadran affiche l'opérande, un registre à deux fenêtres calcule, et un volant d'inertie tourne d'un tiers de tour à chaque phase.",
  body: [
    plate(),
    reset(),
    rack(),
    rails(),
    `<g data-part="spring-back">${M.springParts(k, P, initial.cx).back}</g>`,
    S(k.slabOf({ x: -159, y: M.SPRING.y - 1.7, w: 181, d: 3.4, r: 1.2 }, 1.3, 3.4, P, 3, 0.3), { tone: "mid", crease: "none" }),
    `<g data-part="spring-front">${M.springParts(k, P, initial.cx).front}</g>`,
    `<g data-part="plunger" transform="${k.translateAlong(P, [initial.cx, 0, initial.dz])}">${plunger()}</g>`,
    `<g data-part="carriage" transform="${k.translateAlong(P, [initial.cx, 0, 0])}">${carriage()}</g>`,
    decoder(),
    `<g data-part="selector" transform="${k.translateAlong(P, [initial.sel, 0, 0])}">${selector()}</g>`,
    `<g data-part="wire1">${M.wireOne(k, P, initial.cx)}</g>`,
    supply(),
    clock(),
    phaseRail(),
    `<g data-part="slider" transform="${k.translateAlong(P, [M.PHASE_X(initial.slider), 0, 0])}">${phaseSlider()}</g>`,
    dial(),
    `<path data-part="needle" class="iso-line" data-tone="hi" data-free="start" d="${M.needleD(k, P, initial.dial)}" style="stroke-width:1.1"/>`,
    M.wireThree(k, P),
    accumulator(),
    M.wireTwo(k, P),
  ],
});

const EXTRA_CSS = `
.mi-well{fill:var(--anatomy-shade-0);stroke:none}
.mi-digit{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-weight:500}
.iso-stage{outline:none;cursor:pointer}
.iso-stage:focus-visible{box-shadow:0 0 0 1px var(--anatomy-mid)}
@media (max-width:560px){.iso-plate{overflow:hidden}.iso-stage .iso-svg{width:118%;margin-left:-9%}}
`;

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const live = `
const k = { iso, solidSvg, lineSvg, dotsSvg, cylinder, radialTicks, lineOnTop, wireSvg, coil, slabOf };
const P = ${JSON.stringify(P)};
${modelSource}
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const carriage = part("carriage"), plunger = part("plunger"), selector = part("selector"), slider = part("slider");
const springBack = part("spring-back"), springFront = part("spring-front");
const fly = part("fly"), needle = part("needle"), wire1 = part("wire1");
const digits = { acc: [part("acc-a"), part("acc-b")], out: [part("out-a"), part("out-b")] };
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let clock = 1.6, playing = !still.matches, fastTo = null, frame = 0, last = 0, visible = false, shown = "";
const two = (value) => String(Math.max(0, Math.min(99, Math.round(value)))).padStart(2, "0");
function draw() {
  const s = stateAt(clock);
  carriage.setAttribute("transform", translateAlong(P, [s.cx, 0, 0]));
  plunger.setAttribute("transform", translateAlong(P, [s.cx, 0, s.dz]));
  selector.setAttribute("transform", translateAlong(P, [s.sel, 0, 0]));
  slider.setAttribute("transform", translateAlong(P, [PHASE_X(s.slider), 0, 0]));
  needle.setAttribute("d", needleD(k, P, s.dial));
  wire1.innerHTML = wireOne(k, P, s.cx);
  const sp = springParts(k, P, s.cx);
  springBack.innerHTML = sp.back; springFront.innerHTML = sp.front;
  const f = flywheelSvg(k, P, s.fly);
  if (f !== shown) { fly.innerHTML = f; shown = f; }
  const a = two(s.acc), o = two(s.out);
  digits.acc[0].textContent = a[0]; digits.acc[1].textContent = a[1];
  digits.out[0].textContent = o[0]; digits.out[1].textContent = o[1];
  if (readout.textContent !== s.readout) readout.textContent = s.readout;
  stage.setAttribute("aria-valuenow", String(s.pc + 1));
  stage.setAttribute("aria-valuetext", s.readout);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (fastTo !== null) { clock += dt * 5; if (clock >= fastTo) { clock = fastTo; fastTo = null; } }
  else if (playing) clock += dt;
  draw();
  frame = visible && (playing || fastTo !== null) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const next = () => {
  const target = (Math.floor(clock / CYCLE) + 1) * CYCLE;
  if (still.matches) { clock = target + 5.9; draw(); return; }
  fastTo = target; playing = true; run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("click", next);
stage.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === "Enter") { event.preventDefault(); next(); }
  if (event.key === " ") { event.preventDefault(); playing = !playing && !still.matches; if (playing) run(); }
});
window.__machine = { show(t) { playing = false; fastTo = null; clock = t; draw(); } };
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Machine à instructions",
  hint: "Clic : instruction suivante",
  readout: initial.readout,
  keys: [
    { mark: "lit", label: "Curseur de phase : chercher, décoder, exécuter" },
    { mark: "raised", label: "Cinq cellules de programme, chevilles = code et opérande" },
  ],
  caption:
    "Un ordinateur répète trois gestes. Chercher : la tête lit une cellule de la mémoire. Décoder : le sélecteur se place sur l'opération et le cadran lit l'opérande. Exécuter : le registre calcule. Le volant avance d'un tiers de tour par phase.",
  body: `<style>${EXTRA_CSS}</style><div class="iso-stage" tabindex="0" role="slider" aria-label="Machine à instructions : Entrée ou flèche droite pour passer à l'instruction suivante, espace pour mettre en pause" aria-valuemin="1" aria-valuemax="5" aria-valuenow="1">${svg}</div>`,
});

const file = theme === "light" ? "machine-a-instructions-light.html" : "machine-a-instructions.html";
writeFileSync(join(HERE, "..", "..", "docs", file), k.pageHtml({ title: "Machine à instructions", theme, body, script: kitScript() + live }).replace('lang="en"', 'lang="fr"'));
console.log("wrote", file);
