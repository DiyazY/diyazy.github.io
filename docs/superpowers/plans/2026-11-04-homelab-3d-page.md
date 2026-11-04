# Home-lab 3D Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/homelab.html` page with an interactive Three.js model of the home lab (rack view + network-topology view) backed by one data file, with a full HTML fallback.

**Architecture:** `_data/homelab.yml` is the single source. Liquid renders the HTML device list and embeds the same data as JSON. A pure, DOM-free layout module computes positions and links (unit-tested with `node --test`); a scene module builds meshes with Three.js (pinned, loaded via import map from jsdelivr) and wires interaction. Build checks validate the embedded data and guard against leaking private network details.

**Tech Stack:** Jekyll/Liquid, Three.js 0.187.0 (ES modules, no build step), Node 24 built-in test runner, Bash + Ruby build checks, Playwright for visual verification.

**Spec:** `docs/superpowers/specs/2026-11-04-homelab-3d-page-design.md`

## Global Constraints

- Three.js pinned to `0.187.0`: `https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js` and `.../three@0.187.0/examples/jsm/` for addons. Loaded on `/homelab.html` only.
- Never published: IP addresses/ranges, hostnames/MagicDNS names, Tailscale details, SSH/key setup, ports, secrets.
- Palette: scene background follows theme tokens (`--color-primary` `#2a2521` family); highlight/LEDs/packets gold `#c9a227`.
- Tiers, top to bottom: `network`, `servers`, `gpu`, `pis`, `storage`; `cooling` sits on the cabinet roof.
- Tween duration 1.2 s, ease-in-out. `prefers-reduced-motion: reduce` → no auto-rotate, no packets, no fan spin, instant view switch.
- Render loop runs only while the canvas is on screen and the tab is visible; `devicePixelRatio` capped at 2.
- Not in the nav. Home page HomeLab tile: change `href`/`onclick` target only.
- Analytics events: `homelab_device_selected` `{device}` and `homelab_view_toggled` `{view}`, via `window.posthog.capture` guarded by `if (window.posthog)` at call time.
- No new npm dependencies for the site. Tests use `node --test` only.
- Local builds use Homebrew Ruby: `export PATH=/opt/homebrew/opt/ruby/bin:$PATH`.

## Review Focus

1. **Three.js CDN blocked or WebGL unavailable** → the scene panel shows the fallback note, the HTML list still works, no blank panel, no uncaught error. Test: Task 3 Step 6.
2. **Touch / drag-to-orbit** → a drag that moves the pointer more than 5 px must not select a device; a tap must. Test: Task 4 Step 5.
3. **Rapid toggling Rack ↔ Network mid-tween** → ends settled in the last chosen view, no device stuck between layouts. Test: Task 5 Step 5.
4. **A typo in `_data/homelab.yml`** (unknown `uplink`, duplicate `id`, bad `tier`) → the build check fails naming the device, rather than a silently broken scene. Test: Task 1 Step 6.
5. **Viewport resize / phone rotation** → canvas re-sizes to its container with no stretching. Test: Task 3 Step 7.

---

### Task 1: Data file, static page, tile link, build checks

**Files:**
- Create: `_data/homelab.yml`, `homelab.html`, `assets/css/homelab.css`
- Modify: `index.html` (HomeLab tile: `/blog.html?tag=homelab` → `/homelab.html`, both `onclick` and `href`), `_includes/breadcrumbs.html` (add `/homelab` → "Home Lab" branch, JSON-LD and visible, before the generic branches), `.github/scripts/check-build.sh`, `.github/scripts/check-build-test.sh`

**Interfaces:**
- Produces: `_data/homelab.yml` shape — top-level `devices:` list; each item has `id`, `name`, `model`, `specs`, `role`, `services` (list, may be empty), `kind` (one of `nuc jetson seeed pi4 pi3 pi-zero switch router nas fan ruuvi`), `tier` (one of `network servers gpu pis storage cooling`), optional `uplink` (an `id` or `internet`), optional `link` (`usb-c-40g`), optional `links` (list of `{label, url}`). Top-level `intro:` string.
- Produces: in `homelab.html`, `<script type="application/json" id="homelab-data">{{ site.data.homelab | jsonify }}</script>`; scene container `<div id="homelab-scene" class="homelab-scene">` containing `<p class="homelab-fallback" hidden>`; list items `<button class="homelab-device" data-device="<id>">`; info card `<aside id="homelab-card" hidden>`; toggle `<div class="homelab-toggle" role="group">` with `<button data-view="rack" aria-pressed="true">Rack</button><button data-view="network" aria-pressed="false">Network</button>`; reset `<button id="homelab-reset">`.

- [ ] **Step 1: Write `_data/homelab.yml`** with the 18 devices from spec §4 (Pi 4 ×3 → `pi4-1..3`, Pi 3 ×3 → `pi3-1..3`, fans → `fan-1`, `fan-2`; NA-FC1 folded into the fans' `specs`). Uplinks per the spec table; Seeed: `uplink: jetson`, `link: usb-c-40g`. Fans and Ruuvi have no `uplink`. Links: NUCs and Pi 4s → `/projects/edge-k8s-performance.html` ("Edge Kubernetes research"), NUCs → `/projects/di-agent.html`. Copy specs from the home-lab README hardware table. No IPs or hostnames.

- [ ] **Step 2: Add the failing build checks to `check-build.sh`** (new section `# --- home lab ---`), using `ruby -rjson` on the JSON extracted from `$SITE/homelab.html` (`id="homelab-data"`):
  - `homelab.html exists and is non-empty`
  - `homelab data invalid: <message>` on: duplicate id (`duplicate id <id>`), unknown tier (`<id> has unknown tier <tier>`), unknown kind, uplink not an id and not `internet` (`<id> uplink <x> not found`), uplink cycle (`uplink cycle at <id>`).
  - `homelab.html leaks private network details` if the page matches `/\b10\.\d+\.\d+\.\d+|\b100\.\d+\.\d+\.\d+|tailscale|magicdns|\.ts\.net/i`.
  - `index.html HomeLab tile links to /homelab.html`.

- [ ] **Step 3: Run checks to verify they fail**

Run: `JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter && ./.github/scripts/check-build.sh _site`
Expected: FAIL `homelab.html missing or empty`.

- [ ] **Step 4: Build `homelab.html` + `homelab.css`** per the Interfaces block. Layout `default`, `title: Home Lab`, description from spec §1. Structure per spec §3: breadcrumbs, `h1`, intro, scene panel (empty container with hidden fallback text "The 3D view needs WebGL — here's everything in it below."), "What runs here" grouped by tier (headings: Network, Servers, GPU inference, Raspberry Pi fleet, Storage, Cooling), each device a `<button class="homelab-device">` showing name + role, with model/specs/services in a `<dl>` below it. Posts tagged `homelab` section only if any exist. Scene panel height `70vh` desktop / `60vh` below 768px, min 360px; reuse the `.series-page`/`.series-container` centred-panel pattern but max-width 1100px. Edit `index.html` tile and breadcrumbs.

- [ ] **Step 5: Run checks to verify they pass**

Run: same as Step 3. Expected: `all checks passed`.

- [ ] **Step 6: Add fixtures to `check-build-test.sh`** — a second helper `expect_homelab_fail <name> <json> <message>` that copies the site, replaces the `homelab-data` script contents, and asserts check-build reports `homelab data invalid: <message>`. Fixtures: duplicate id → `duplicate id a`; uplink `nope` → `a uplink nope not found`; `a→b→a` → `uplink cycle at a`; tier `attic` → `a has unknown tier attic`. Plus one leak fixture: inject `10.10.0.11` into the page → `leaks private network details`.

Run: `./.github/scripts/check-build-test.sh _site`
Expected: every line `ok`, ends `all fixtures caught`.

- [ ] **Step 7: Commit**

```bash
git add _data/homelab.yml homelab.html assets/css/homelab.css index.html _includes/breadcrumbs.html .github/scripts/check-build.sh .github/scripts/check-build-test.sh
git commit -m "Home lab: data file, static page and build checks"
```

---

### Task 2: Pure layout module + unit tests

**Files:**
- Create: `assets/js/homelab-layout.js`, `.github/scripts/homelab-test/layout.test.mjs`
- Modify: `.github/workflows/build.yml` (step "Test home-lab layout" after "Check generated output": `node --test .github/scripts/homelab-test/`)

**Interfaces:**
- Consumes: device objects shaped as in Task 1.
- Produces (all named ES exports, no imports, no DOM):
  - `TIERS: string[]` = `['network','servers','gpu','pis','storage']`
  - `rackLayout(devices) -> Map<string, {x:number,y:number,z:number}>` — every device. Tier i shelf at `y = (TIERS.length - 1 - i) * SHELF_GAP`; `cooling` at `y = TIERS.length * SHELF_GAP` (roof). Within a tier, devices spread evenly along x centred on 0 in data order, `z = 0`. `SHELF_GAP = 1.1`, `SHELF_WIDTH = 6` (exported).
  - `topologyLayout(devices) -> Map<string, {x,y,z}>` — virtual node `internet` plus every device with an `uplink`; devices without one are absent. Depth = hops from `internet`; `y = -depth * LAYER_GAP` (`LAYER_GAP = 1.4`, exported) shifted so the tree is vertically centred on 0; nodes in a layer spread along x, ordered by parent's x then data order; `z = 0`.
  - `topologyLinks(devices) -> Array<{from:string,to:string,kind:'ethernet'|'usb-c-40g'}>` — one per device with an uplink (`from` = uplink).
  - `validate(devices) -> void` — throws `Error` with the same messages as the build check (`duplicate id X`, `X uplink Y not found`, `uplink cycle at X`, `X has unknown tier T`).
  - `easeInOut(t) -> number` — cubic, clamps t to [0,1].
  - `lerp3(a, b, t) -> {x,y,z}`.

- [ ] **Step 1: Write failing tests** in `layout.test.mjs` (`import test from 'node:test'`, `assert from 'node:assert/strict'`, import from `../../../assets/js/homelab-layout.js`), fixture of 6 devices across 3 tiers + a fan + a USB-C pair:
  - `rackLayout places every device` — size equals fixture length.
  - `tiers stack top to bottom` — every `network` y > every `servers` y > every `gpu` y; fan y greater than all.
  - `devices in a tier are centred and distinct` — x values unique and their mean is 0 (±1e-9).
  - `topology starts at internet` — `internet` present with the greatest y; fan absent.
  - `children sit one layer below their uplink` — for every link, `y(from) - y(to) === LAYER_GAP`.
  - `usb-c link is typed` — link from jetson to seeed has `kind === 'usb-c-40g'`, others `'ethernet'`.
  - `validate rejects bad data` — four `assert.throws` with the exact messages above.
  - `easeInOut endpoints and clamping` — 0→0, 1→1, 0.5→0.5, -1→0, 2→1.

- [ ] **Step 2: Run to verify failure**

Run: `node --test .github/scripts/homelab-test/`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `assets/js/homelab-layout.js`** with the exports above.

- [ ] **Step 4: Run to verify pass**

Run: `node --test .github/scripts/homelab-test/`
Expected: all tests pass.

- [ ] **Step 5: Add the CI step and commit**

```bash
git add assets/js/homelab-layout.js .github/scripts/homelab-test .github/workflows/build.yml
git commit -m "Home lab: layout module with unit tests"
```

---

### Task 3: Scene — rack view, render loop, fallback

**Files:**
- Create: `assets/js/homelab-scene.js`
- Modify: `homelab.html` (import map + `<script type="module" src="/assets/js/homelab-scene.js">`), `assets/css/homelab.css`

**Interfaces:**
- Consumes: `rackLayout`, `validate`, `TIERS`, `SHELF_GAP`, `SHELF_WIDTH` (Task 2); DOM ids from Task 1.
- Produces (module-internal, used by Tasks 4–5): `meshes: Map<id, THREE.Object3D>` (one group per device, `userData.id = id`); `state = { view: 'rack'|'network', reducedMotion: boolean }`; `requestRender()`; `container.dataset.view` (`rack`/`network`), `container.dataset.settled` (`"true"` when no tween runs), `container.dataset.ready` (`"true"` after first frame), `container.dataset.motion` (`"reduced"` or `"full"`).

- [ ] **Step 1: Import map in `homelab.html`** mapping `three` and `three/addons/` to the pinned URLs (Global Constraints). Module script after it.

- [ ] **Step 2: Implement mesh builders** — `buildDevice(device) -> THREE.Group`, switching on `kind` (proportions: nuc 1.1×0.5×1.1; jetson/seeed 1.0×0.35×0.9; pi4 0.85×0.25×0.6; pi3 0.85×0.2×0.6; pi-zero 0.65×0.12×0.3; switch 1.6×0.25×0.8; router cylinder r0.45 h0.6; nas 1.0×1.0×1.2; fan torus+blades r0.45; ruuvi cylinder r0.18 h0.06). Muted greys (`MeshStandardMaterial`, roughness ~0.7), one small gold emissive LED per networked device. Cabinet: open-front frame, one shelf per tier at `rackLayout` y minus half device height, width `SHELF_WIDTH + 0.6`. Jetson↔Seeed cable: tube between them.

- [ ] **Step 3: Scene setup** — renderer (antialias, alpha false, `setPixelRatio(Math.min(devicePixelRatio, 2))`), background from computed `--color-primary` (re-read on theme toggle via `MutationObserver` on `<html data-theme>`), hemisphere + directional light, OrbitControls (`enableDamping`, `minPolarAngle 0.2`, `maxPolarAngle 1.45`, azimuth ±1.2 rad, `minDistance 6`, `maxDistance 18`, `autoRotate` with speed 0.4 unless reduced motion; stop on `start` event). Reset button restores camera + target. Fan rotation in the loop unless reduced motion.

- [ ] **Step 4: Render loop gating** — `IntersectionObserver` + `visibilitychange`; loop only while visible. `ResizeObserver` on the container sets renderer size and camera aspect.

- [ ] **Step 5: Fallback** — wrap renderer creation and the dynamic `import('three')` in try/catch; on failure (or `!WebGL2RenderingContext` / context creation null) unhide `.homelab-fallback`, hide toggle and reset, set `dataset.ready = "fallback"`. Never throw to the console as uncaught.

- [ ] **Step 6: Verify fallback (Review Focus 1)** — serve locally (`bundle exec jekyll serve --port 4011`), Playwright: route `**/three@0.187.0/**` to abort, load `/homelab.html`. Expected: `.homelab-fallback` visible, `#homelab-scene[data-ready="fallback"]`, zero console errors except the aborted request, device list buttons present.

- [ ] **Step 7: Verify rack view + resize (Review Focus 5)** — Playwright at 1280×860 then 390×844: wait for `[data-ready="true"]`; screenshot; assert `canvas.width === Math.round(container.clientWidth * Math.min(devicePixelRatio,2))` after each resize; no horizontal overflow; no console errors. Light and dark (`data-theme`). With `emulateMedia({reducedMotion:'reduce'})`: `data-motion="reduced"`.

- [ ] **Step 8: Commit**

```bash
git add assets/js/homelab-scene.js homelab.html assets/css/homelab.css
git commit -m "Home lab: 3D rack view with fallback"
```

---

### Task 4: Interaction — hover, select, info card, list sync

**Files:**
- Modify: `assets/js/homelab-scene.js`, `assets/css/homelab.css`

**Interfaces:**
- Consumes: `meshes`, `state`, `requestRender` (Task 3); `#homelab-card`, `.homelab-device[data-device]` (Task 1).
- Produces: `select(id: string|null, {source: 'scene'|'list'}) -> void`; `container.dataset.selected` = selected id or `""`.

- [ ] **Step 1: Picking** — `Raycaster` on `pointermove` (hover: gold emissive on the group's materials, `cursor: pointer`) and on `pointerup` only if the pointer moved ≤ 5 px since `pointerdown` (tap/click selects; empty space deselects).

- [ ] **Step 2: Info card** — `select()` fills `#homelab-card` (name, model, specs, role, services list, links) from the data, unhides it, sets `aria-pressed` on the matching list button, `dataset.selected`. Card: right-side panel ≥ 900px, bottom sheet below; close button and `Escape` → `select(null)`. Analytics `homelab_device_selected` `{device: id}`.

- [ ] **Step 3: List sync** — list buttons call `select(id, {source:'list'})`, scroll the scene into view, and ease the OrbitControls target toward the device over 0.6 s (instant with reduced motion). In fallback mode list buttons only toggle their own `<dl>` (no card).

- [ ] **Step 4: Verify select** — Playwright: click the canvas at the projected screen position of `nuc-1` (compute via a `page.evaluate` that reads `window.__homelabProject?.('nuc-1')` — expose `__homelabProject(id) -> {x,y}` only when `location.hostname === 'localhost'`); expect `data-selected="nuc-1"` and card text contains "K3s primary server". Click list button `pi3-1` → `data-selected="pi3-1"`. Press Escape → `data-selected=""`.

- [ ] **Step 5: Verify drag doesn't select (Review Focus 2)** — `page.mouse.down()` on `nuc-1`'s position, move 40 px, `up()`. Expected: `data-selected` unchanged.

- [ ] **Step 6: Commit**

```bash
git add assets/js/homelab-scene.js assets/css/homelab.css
git commit -m "Home lab: hover, select and info card"
```

---

### Task 5: Network view — tween, links, packets, labels

**Files:**
- Modify: `assets/js/homelab-scene.js`, `assets/css/homelab.css`

**Interfaces:**
- Consumes: `topologyLayout`, `topologyLinks`, `easeInOut`, `lerp3` (Task 2); `meshes`, `state`, `select` (Tasks 3–4); toggle buttons (Task 1).
- Produces: `setView(view: 'rack'|'network') -> void`.

- [ ] **Step 1: `setView`** — retargetable tween: on each call, start from every mesh's *current* position to the target layout's position, 1.2 s `easeInOut`; devices absent from the topology (fans, Ruuvi) and the cabinet fade opacity to 0 (and back). Internet node: a small gold wireframe icosahedron, visible only in network view. Reduced motion → jump instantly. Update `aria-pressed`, `dataset.view`, `dataset.settled` (`"false"` during, `"true"` after). Analytics `homelab_view_toggled` `{view}`.

- [ ] **Step 2: Links** — one `Line` per `topologyLinks` entry, positions updated every frame from current mesh positions, opacity tied to the view tween. `usb-c-40g` drawn as a thicker tube, gold.

- [ ] **Step 3: Packets** — per link, 1–2 small gold spheres travelling `from → to` and back at staggered intervals (period 1.8–3 s; USB-C link 0.8 s). Only in network view and only when not reduced motion.

- [ ] **Step 4: Labels** — `CSS2DRenderer` labels (device name; USB-C link label "40 Gbps USB-C") shown only when `state.view === 'network'`. Selection, hover and the info card keep working in network view.

- [ ] **Step 5: Verify (Review Focus 3)** — Playwright: click Network, wait `data-settled="true"`, screenshot (desktop + phone, light + dark). Then click Network → Rack → Network → Rack within 300 ms total; wait `data-settled="true"`; expect `data-view="rack"` and, via `__homelabProject`, `nuc-1`'s position matching its rack position (compare against a second fresh load). With reduced motion: clicking Network sets `data-settled="true"` immediately. No console errors.

- [ ] **Step 6: Commit**

```bash
git add assets/js/homelab-scene.js assets/css/homelab.css
git commit -m "Home lab: network view with animated traffic"
```

---

### Task 6: Final verification, review screenshots, PR

**Files:** none new.

- [ ] **Step 1: Full checks**

Run:
```bash
export PATH=/opt/homebrew/opt/ruby/bin:$PATH
JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter -d $SCRATCH/site && ./.github/scripts/check-build.sh $SCRATCH/site && ./.github/scripts/check-build-test.sh $SCRATCH/site
JEKYLL_ENV=production bundle exec jekyll build --future --strict_front_matter -d $SCRATCH/site_future && CHECK_ALLOW_FUTURE=1 ./.github/scripts/check-build.sh $SCRATCH/site_future
node --test .github/scripts/homelab-test/
```
Expected: `all checks passed`, `all fixtures caught`, all node tests pass.

- [ ] **Step 2: Confirm the home page is visually unchanged** — Playwright screenshot of `/` vs live `https://diyaz.dev/` at 1280px: identical tiles; HomeLab tile navigates to `/homelab.html`.

- [ ] **Step 3: Share screenshots with Diyaz** (rack + network, desktop + phone, light + dark, a selected device card) and wait for approval.

- [ ] **Step 4: Push and open the PR** after approval, with the screenshots' findings and test results in the description.
