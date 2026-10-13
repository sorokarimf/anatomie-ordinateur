# Anatomy of a computer

*[Version française → README.md](README.md)*

Two **interactive isometric figures** that explain how a computer works by showing real objects instead of boxes and arrows:

| Figure | What it explains |
|---|---|
| **Instruction machine** | A processor's cycle: *fetch* an instruction from memory, *decode* it, *execute* it. A read head, a decoder, a two-window register and a clock flywheel run a real tiny program (3 + 4 + 5 − 2 = 10). |
| **Exploded laptop** | The 9 components of a laptop (case, battery, motherboard, processor, RAM, SSD, cooling, keyboard, display), which you can **assemble one by one** until you get the complete machine. |

Each figure is **a single self-contained HTML file**: no server, no dependencies, light and dark themes. The interface text is in French.

![Exploded laptop](assets/laptop-eclate.png)
![Assembled laptop](assets/laptop-monte.png)
![Instruction machine](assets/machine.png)

## View the figures

Open a file from [`docs/`](docs/) directly in your browser (double-click):

- [`docs/laptop-light.html`](docs/laptop-light.html) · [`docs/laptop.html`](docs/laptop.html) (dark)
- [`docs/machine-a-instructions-light.html`](docs/machine-a-instructions-light.html) · [`docs/machine-a-instructions.html`](docs/machine-a-instructions.html) (dark)

**Online with GitHub Pages**: in the repository, *Settings → Pages → Build and deployment → Deploy from a branch → `main` / folder `/docs`*. The landing page is [`docs/index.html`](docs/index.html).

## Usage

### Exploded laptop
- **Hover** a part, or click its numbered pill under the figure: the part lights up and its role is described.
- **Monter** (assemble) places the parts in order, one every 1.7 s; the button becomes **Pause**, then **Démonter** (disassemble) once the machine is complete (the screen turns on).
- Keyboard: `Space` / `Enter` assemble or disassemble, `←` `→` browse parts, `Esc` clear the selection.
- With no interaction the figure plays an assembly then a disassembly on its own, in a loop.

### Instruction machine
- **Click**, `Enter` or `→`: next instruction. `Space`: pause.
- The text at the bottom right shows the phase (*chercher* = fetch, *décoder* = decode, *exécuter* = execute) and the current calculation.

## Embed a figure in your site

Copy the HTML file you want, then:

```html
<iframe src="laptop-light.html" title="Exploded laptop"
        width="900" height="1100" loading="lazy" style="border:0"></iframe>
```

## Rebuild from source

Requirements: **Node.js 20.10 or newer**. Google Chrome or Chromium is only needed for the checks and screenshots.

```bash
git clone https://github.com/sorokarimf/anatomie-ordinateur.git
cd anatomie-ordinateur

npm run build:machine        # instruction machine (a few seconds)
npm run build:laptop:fast    # laptop, approximate draw order (~15 s): for iterating
npm run build:laptop         # laptop, final version (~6 min per theme)
```

Files are written to `docs/`. There are **no npm dependencies** to install.

> Why 6 minutes? The laptop has 85 moving parts. The build measures, for every pair of parts that overlap on screen, which one is in front, across nearly 1,000 positions of the assembly, and derives the draw order from that. `--fast` skips this measurement: fine for trying things out, not for publishing.

### Quality checks

```bash
npm run audit:laptop   # full geometry audit: must end with "audit passed"
npm run check          # checks that every drawn line ends on something (needs Chrome)
```

On the laptop, the audit verifies that no part passes through another (assembled, exploded and in motion), that every part rests on another, and that the draw order is correct in every position.

## Repository layout

```
docs/                        ready-to-use figures (self-contained HTML) + index.html
assets/                      README screenshots
figures/
  machine-a-instructions/    build.mjs (drawing) + model.mjs (animated model)
  laptop/                    build.mjs (parts, motion) + live.js (interaction) + laptop.css
kit/                         isometric engine (see NOTICE.md)
scripts/                     page builder, screenshots, line check (see NOTICE.md)
checks/                      verification scenarios (npm run check)
```

## Make your own figure

**By hand.** Copy `figures/laptop/` to `figures/my-figure/`, then in `build.mjs`:

1. Describe the assemblies in `PIECES`: a name, explanation text (`say`, `desc`) and an explode vector `move`.
2. Set `ORDER` (bottom to top, which is the assembly order); `STAGGER` is its reverse.
3. Draw parts with `slabPart` (boxes), `cylPart` (cylinders) or `put` (free shapes). Each part **records its real shape**, which lets the audit check the drawing.
4. Run `node figures/my-figure/build.mjs --light --fast`, open `docs/` and iterate.
5. To finish: full build, then `--audit`, which must end with `audit passed`.

Rules that matter: a part resting on another is never sunk into it; every line ends on an edge, a dot or an outline; a part moving into place must never pass through another.

**With Claude Code.** The engine comes from the *anatomy* skill. Once installed you can describe the figure you want:

```bash
npx skills add wheresryan22/anatomy
```

> A skill can contain scripts: read its contents before installing it. Then ask, for example: "Using the anatomy skill, make an interactive exploded view of a graphics card." The skill's repository documents all the drawing rules.

## Known limitations

- Component descriptions give generic orders of magnitude (for example "50 to 70 Wh" for the battery), not those of a specific model.
- The camera is a fixed angle from above: lower parts are partly hidden by upper ones, as in any exploded view; selecting a part helps locate it.
- The dark theme is deliberately low-contrast; the light theme is the reference.

## Credits and license

- Figure code: **MIT** license (see [`LICENSE`](LICENSE)).
- Isometric engine (`kit/`, part of `scripts/`): **Anatomy** by [wheresryan22](https://github.com/wheresryan22/anatomy), MIT license, © 2026 Ryan. Details in [`NOTICE.md`](NOTICE.md).
