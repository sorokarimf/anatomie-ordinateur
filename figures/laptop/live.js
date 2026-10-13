const D = __DATA__;
const CAPTION = __CAPTION__;
const root = document.querySelector(".lt");
const stage = root.querySelector(".lt-stage");
const parts = stage.querySelector(".lt-parts");
const readout = root.querySelector("[data-readout]");
const desc = root.querySelector("[data-desc]");
const live = root.querySelector("[data-live]");
const goButton = root.querySelector("[data-go]");
const goLabel = root.querySelector("[data-go-label]");
const hint = root.querySelector(".lt-hint");
const partButtons = [...root.querySelectorAll(".lt-part")];
const fanGroup = parts.querySelector("[data-fan]");
const screenGroup = parts.querySelector("[data-screen] > g");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const nodes = [...parts.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  shown: "",
}));
for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
let order = nodes.map((_, index) => index);

const ORDER = D.order;
const COUNT = ORDER.length;
const STAGGER = D.stagger;
const SPRING = D.spring;
const piece = Object.fromEntries(STAGGER.map((id) => [id, { x: id === "stand" ? 0 : 1, v: 0, target: id === "stand" ? 0 : 1, pending: null }]));
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const smooth = (value) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

const STEP = 1.7;
let clock = 0;
let installed = 0;
let auto = false;
let nextAt = 0;
let mode = "apart";
let hovered = null;
let pinned = null;
let selected = null;
let touring = !still.matches;
let tourAt = -1;
let leaveTimer = 0;
let fanAngle = 0;
let visible = false;
let frame = 0;
let last = 0;
let announced = "";

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}
function announce(text) {
  if (announced !== text) {
    announced = text;
    live.textContent = text;
  }
}

function status() {
  const focus = hovered || pinned;
  if (focus) return D.pieces[focus].say;
  if (mode === "assembling") return `montage · ${installed}/${COUNT} · ${D.pieces[ORDER[Math.max(0, installed - 1)]].name.toLowerCase()}`;
  if (mode === "assembled") return "monté · machine complète";
  if (mode === "disassembling") return "démontage…";
  return installed > 0 ? `${installed}/${COUNT} montés` : `éclaté · ${COUNT} composants`;
}

function refresh() {
  const autoId = auto && installed > 0 ? ORDER[installed - 1] : null;
  const next = hovered || pinned || autoId;
  if (next !== selected) {
    selected = next;
    for (const node of nodes) {
      if (selected && node.piece === selected) node.el.setAttribute("data-on", "");
      else node.el.removeAttribute("data-on");
    }
    if (selected) stage.setAttribute("data-focus", "");
    else stage.removeAttribute("data-focus");
    partButtons.forEach((button) => (button.dataset.part === selected ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
    desc.textContent = selected ? D.pieces[selected].desc : CAPTION;
    stage.setAttribute("aria-valuenow", String(selected ? ORDER.indexOf(selected) + 1 : 0));
  }
  const text = status();
  say(text);
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
  let label = "Monter";
  if (installed === COUNT && !auto) label = "Démonter";
  else if (auto) label = "Pause";
  if (goLabel.textContent !== label) goLabel.textContent = label;
  goButton.dataset.state = auto ? "on" : installed === COUNT ? "done" : "off";
  hint.textContent = installed > 0 && installed < COUNT && !auto ? "Montage en pause · Monter pour continuer" : "Survolez une pièce pour la découvrir";
}

function target(id, value, delay = 0) {
  const state = piece[id];
  if (state.target === value && !state.pending) return;
  state.pending = { value, at: clock + (still.matches ? 0 : delay) };
}

function disassemble() {
  auto = false;
  installed = 0;
  mode = "disassembling";
  STAGGER.forEach((id, index) => {
    if (id !== "stand") target(id, 1, index * SPRING.stagger);
  });
  announce("démontage");
  refresh();
  run();
}

function installNext() {
  if (installed >= COUNT) return;
  installed += 1;
  target(ORDER[installed - 1], 0);
  announce(`étape ${installed} sur ${COUNT} · ${D.pieces[ORDER[installed - 1]].name}`);
}

function assemble() {
  if (installed >= COUNT) installed = 0;
  auto = true;
  mode = "assembling";
  nextAt = clock;
  refresh();
  run();
}

function toggleGo() {
  touring = false;
  if (auto) {
    auto = false;
    mode = "apart";
  } else if (installed === COUNT) disassemble();
  else assemble();
  refresh();
  run();
}

function springStep(state, dt, calm) {
  if (state.pending && clock >= state.pending.at) {
    state.target = state.pending.value;
    state.pending = null;
  }
  if (calm) {
    state.x = state.target;
    state.v = 0;
    return false;
  }
  for (let index = 0; index < SPRING.substeps; index++) {
    const h = dt / SPRING.substeps;
    state.v += ((state.target - state.x) * SPRING.stiffness - state.v * SPRING.damping) * h;
    state.x += state.v * h;
  }
  if (Math.abs(state.target - state.x) < 2e-4 && Math.abs(state.v) < 2e-4) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  return true;
}

function bladesOf(angle) {
  const out = [];
  const z = D.fan.z;
  for (let i = 0; i < 9; i++) {
    const a0 = angle + (i * Math.PI * 2) / 9;
    const pts = [];
    for (let s = 0; s <= 6; s++) {
      const r = 5.6 + (s / 6) * 14.2;
      const a = a0 + (s / 6) * 0.9;
      pts.push([D.fan.x + Math.sin(a) * r, D.fan.y - Math.cos(a) * r]);
    }
    out.push(onTop(pts, z, D.P));
  }
  return lineSvg(out.join(""), { tone: "mid" });
}

function place() {
  for (const node of nodes) {
    const share = piece[node.piece].x;
    const tx = (D.EX[0] * node.m[0] + D.EY[0] * node.m[1] + D.EZ[0] * node.m[2]) * share;
    const ty = (D.EX[1] * node.m[0] + D.EY[1] * node.m[1] + D.EZ[1] * node.m[2]) * share;
    const text = Math.abs(share) < 1e-4 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  const next = nodes.map((_, index) => index).sort((a, b) => nodes[a].key + nodes[a].lift * piece[nodes[a].piece].x - (nodes[b].key + nodes[b].lift * piece[nodes[b].piece].x));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    parts.appendChild(fragment);
    order = next;
  }
  if (screenGroup) screenGroup.style.opacity = (0.16 + 0.84 * (1 - smooth(piece.lid.x * 5))).toFixed(3);
}

const svgEl = stage.querySelector("svg");
let viewKey = "";
function frameView() {
  let e = 0;
  for (const id of ORDER) e = Math.max(e, piece[id].x);
  const t = smooth(e * 1.15);
  const v = D.cam.tight.map((value, index) => value + (D.cam.full[index] - value) * t);
  const text = v.map((value) => value.toFixed(2)).join(" ");
  if (text !== viewKey) {
    viewKey = text;
    svgEl.setAttribute("viewBox", text);
  }
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  let moving = false;
  for (const id of STAGGER) if (springStep(piece[id], dt, calm)) moving = true;
  if (auto && clock >= nextAt) {
    if (installed < COUNT) {
      installNext();
      nextAt = clock + STEP;
      refresh();
    } else if (!moving) {
      auto = false;
      mode = "assembled";
      announce("machine complète");
      refresh();
      if (touring) tourAt = clock + 2.8;
    }
  }
  if (mode === "disassembling" && !moving) {
    mode = "apart";
    refresh();
    if (touring) tourAt = clock + 2.2;
  }
  if (touring && tourAt >= 0 && clock >= tourAt) {
    tourAt = -1;
    if (installed === COUNT) disassemble();
    else assemble();
  }
  const spin = !calm && (moving || selected === "cooling");
  if (spin) {
    fanAngle += dt * 5;
    fanGroup.innerHTML = bladesOf(fanAngle);
  }
  place();
  frameView();
  frame = visible && (moving || auto || spin || (touring && tourAt >= 0) || (touring && tourAt === -1 && mode === "apart" && clock < 1.4)) ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};

function focusOn(id, source) {
  touring = false;
  if (source === "hover") hovered = id;
  else pinned = pinned === id ? null : id;
  refresh();
  run();
}

stage.addEventListener("pointerover", (event) => {
  const item = event.target.closest(".it");
  const id = item && item.dataset.piece !== "stand" ? item.dataset.piece : null;
  clearTimeout(leaveTimer);
  if (id !== hovered) {
    touring = id ? false : touring;
    hovered = id;
    refresh();
    run();
  }
});
stage.addEventListener("pointerleave", () => {
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    hovered = null;
    refresh();
  }, 160);
});
stage.addEventListener("pointerdown", () => {
  touring = false;
});
stage.addEventListener("click", (event) => {
  const item = event.target.closest(".it");
  if (item && item.dataset.piece !== "stand") focusOn(item.dataset.piece, "pin");
});
partButtons.forEach((button) => {
  button.addEventListener("click", () => focusOn(button.dataset.part, "pin"));
  button.addEventListener("pointerenter", () => {
    touring = false;
    hovered = button.dataset.part;
    refresh();
    run();
  });
  button.addEventListener("pointerleave", () => {
    hovered = null;
    refresh();
  });
});
goButton.addEventListener("click", toggleGo);
stage.addEventListener("keydown", (event) => {
  const index = pinned ? ORDER.indexOf(pinned) : -1;
  let handled = true;
  touring = false;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") pinned = ORDER[(index + 1) % COUNT];
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") pinned = ORDER[(index <= 0 ? COUNT : index) - 1];
  else if (event.key === "Home") pinned = ORDER[0];
  else if (event.key === "End") pinned = ORDER[COUNT - 1];
  else if (event.key === "Escape") pinned = null;
  else if (event.key === " " || event.key === "Enter") toggleGo();
  else handled = false;
  if (handled) {
    event.preventDefault();
    refresh();
    run();
  }
});

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

if (touring) tourAt = 1.4;
window.__laptop = {
  show(count) {
    touring = false;
    auto = false;
    installed = count;
    ORDER.forEach((id, index) => {
      piece[id].x = piece[id].target = index < count ? 0 : 1;
      piece[id].v = 0;
      piece[id].pending = null;
    });
    mode = count === COUNT ? "assembled" : count === 0 ? "apart" : "assembling";
    refresh();
    place();
    frameView();
  },
  select(id) {
    pinned = id;
    refresh();
  },
};
refresh();
place();
frameView();
