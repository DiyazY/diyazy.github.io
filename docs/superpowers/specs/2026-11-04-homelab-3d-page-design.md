# Home-lab 3D page — design spec

_Status: approved design and spec · Date: 2026-11-04 · Author: Diyaz Yakubov (with Claude)_

Internal planning document. Not published (see `exclude` in `_config.yml`).

## 1. Goal

A `/homelab.html` page whose centrepiece is an interactive 3D model of the
real home-lab cabinet. Visitors orbit the rack, hover or tap a device to learn
what it is and what runs on it, and switch to a **network view** where the
devices lift off the shelves and rearrange into the real network topology with
animated traffic.

Success means:

- It reads as *Diyaz's actual lab* — the real devices, roles and connections —
  not a generic server render. Physical fidelity to the real cabinet does
  **not** matter (decided at spec review): the layout is idealised to explain
  the lab, grouped by tier.
- It explains the lab: every device answers "what is this, what does it run,
  how is it connected".
- It stays fast and accessible: the same information is available without
  WebGL, without motion, and to search engines.
- Diyaz approves screenshots of the real result before merge (see memory:
  visual changes need a preview).

## 2. Source of truth and disclosure

Hardware, roles and services come from the home-lab repo
(`~/di/projects/home-lab`: `README.md`, `architecture.md`).

**Published:** device models, specs, roles, named services (OpenClaw, n8n,
SolidTime, Obsidian sync, Pi-hole/CoreDNS, Prometheus + Grafana, llama.cpp CPU
inference, GPU inference), physical layout, and network topology as a
diagram.

**Never published:** IP addresses or ranges, hostnames / MagicDNS names,
Tailscale details, SSH/key setup, ports, secrets, anything from `.sops.yaml`.

## 3. Page and placement

- New page `homelab.html` (layout `default`), URL `/homelab.html`.
- **Not** added to the nav (it already has five items).
- The home page's HomeLab tile changes **link target only**
  (`/blog.html?tag=homelab` → `/homelab.html`). Its markup classes, image and
  styling are untouched, so the home page looks identical.
- Page structure, top to bottom:
  1. Breadcrumbs (Home › Home Lab), `h1`, one-paragraph intro.
  2. Scene panel: canvas, **Rack | Network** toggle, reset-view button, info
     card (side panel ≥ 900px, bottom sheet below).
  3. "What runs here": the devices as plain HTML, grouped by tier. Each entry is a button that
     also selects the device in the scene.
  4. Home-lab posts (posts tagged `homelab`), rendered only if any exist.

## 4. Data: `_data/homelab.yml`

Single source for the scene, the info cards and the HTML list. Liquid renders
the list and also writes the data into the page as
`<script type="application/json" id="homelab-data">{{ site.data.homelab | jsonify }}</script>`
for the scene module.

Per device:

| Field       | Meaning                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `id`        | stable slug, used by the scene and the list                            |
| `name`      | display name ("NUC-1")                                                  |
| `model`     | hardware model ("Intel NUC, i7-10710U")                                 |
| `specs`     | short line ("64 GB DDR4 · 1 TB NVMe")                                   |
| `role`      | one line ("K3s primary server")                                         |
| `services`  | list of service names                                                   |
| `kind`      | which mesh to build: `nuc`, `jetson`, `seeed`, `pi4`, `pi3`, `pi-zero`, `switch`, `router`, `nas`, `fan`, `ruuvi` |
| `tier`      | which shelf: `network`, `servers`, `gpu`, `pis`, `storage`, `cooling` |
| `uplink`    | `id` of the device it connects to (builds the topology tree); `link: usb-c-40g` marks the Jetson↔Seeed link |
| `links`     | optional `{label, url}` list: related posts, projects, papers          |

Devices (from the home-lab README). Shelf positions within a tier are
computed by the scene (evenly spaced, left to right in data order), so the
data file carries no coordinates.

| Device                  | Tier     | Role / services                                                        | Uplink        |
| ----------------------- | -------- | ---------------------------------------------------------------------- | ------------- |
| TP-Link Deco            | network  | Gateway, DHCP, WiFi                                                    | internet      |
| TP-LINK TL-SG108        | network  | Primary 8-port gigabit switch                                          | Deco          |
| Teltonika TSW100        | network  | Secondary 5-port switch                                                | TL-SG108      |
| NUC-1                   | servers  | K3s primary server; n8n, SolidTime, OpenClaw                           | TL-SG108      |
| NUC-2                   | servers  | K3s HA server; CPU inference (llama.cpp, 70B+), OpenClaw, Obsidian sync | TL-SG108     |
| Jetson Orin Nano        | gpu      | GPU inference tier 1 (7B–14B models)                                   | TL-SG108      |
| Seeed Studio            | gpu      | GPU inference tier 1, paired with the Jetson                           | Jetson (USB-C 40 Gbps) |
| Raspberry Pi 4 ×3       | pis      | K3s agents; Prometheus + Grafana                                       | TSW100        |
| Raspberry Pi 3 ×3       | pis      | Pi-hole / CoreDNS, monitoring                                          | TSW100        |
| Raspberry Pi Zero W     | pis      | Edge / sensor node                                                     | TSW100        |
| QNAP NAS                | storage  | Central storage (NFS/iSCSI), backups                                   | TL-SG108      |
| Noctua fans ×2 + NA-FC1 | cooling  | Cooling, on the cabinet roof (no network)                              | —             |
| Ruuvi Tag               | servers  | Shelf temperature sensor (no network link drawn)                       | —             |

Multiples (Pi 4 ×3, Pi 3 ×3) are separate entries so each can be selected and
drawn in the topology.

The edge-research papers ran on a NUC + Raspberry Pi testbed; device cards
for the NUCs and Pis link to the relevant project pages
(`/projects/edge-k8s-performance.html` etc.) and to `di-agent`.

## 5. Rack view (default)

- **Model:** procedural low-poly meshes built in code from boxes and
  cylinders (rounded where cheap): an open-front cabinet (the DELTACO, styled
  freely) with one shelf per tier, top to bottom — network, servers, gpu,
  pis, storage — and two Noctua fans on the roof that spin. The Jetson↔Seeed
  USB-C cable is visible on the gpu shelf.
- **Style:** site palette. Warm dark scene background (`#2a2521`-ish, follows
  light/dark theme tokens), muted greys for devices, gold (`#c9a227`) for
  hover highlight, status LEDs and packets. Soft key + fill light, subtle
  ground shadow. No textures, so nothing to download beyond the library.
- **Interaction:** OrbitControls with polar/azimuth limits and min/max zoom;
  slow auto-rotate when idle, stopping on first interaction. Raycast hover →
  emissive gold glow + pointer cursor; click/tap → select device → info card
  (name, model, specs, role, services, links). Esc or the card's close button
  clears selection. Selecting from the HTML list does the same and eases the
  camera toward the device.

## 6. Network view (toggle)

- **Rack | Network** segmented toggle. On switch, each device tweens
  (~1.2 s, ease-in-out) from its shelf position to a layered topology layout:
  Internet → Deco → TL-SG108 → {NUC-1, NUC-2, QNAP, Jetson ↔ Seeed, TSW100 →
  {Pi 4 ×3, Pi 3 ×3, Pi Zero}}. Cabinet, shelves, fans and Ruuvi fade out.
- Links are drawn as lines; small gold packets travel along them at varied
  intervals. The Jetson↔Seeed USB-C 40 Gbps link is thicker with faster
  packets and a "40 Gbps USB-C" label.
- Device name labels (CSS2DRenderer) appear in network view only.
- Toggling back reverses the tween; cabinet fades in.

## 7. Technical design

- **Library:** Three.js pinned to one version, loaded only on this page from
  `cdn.jsdelivr.net/npm/three@<version>/` through an import map (`three` and
  `three/addons/` for OrbitControls and CSS2DRenderer). No build step.
- **Code:** one ES module, `assets/js/homelab-scene.js`, split into small
  functions: build meshes per `kind`, rack layout, topology layout, tween,
  packets, picking, UI wiring. Styles in `assets/css/homelab.css`.
- **Performance:** render loop runs only while the canvas is on screen
  (IntersectionObserver) and the tab is visible; `devicePixelRatio` capped at
  2; ~40 meshes, no shadows beyond one cheap contact shadow.
- **Reduced motion** (`prefers-reduced-motion: reduce`): no auto-rotate, no
  packets, no fan spin, view switch is instant.
- **No WebGL / module load failure:** the scene panel shows a short note
  ("The 3D view needs WebGL — here's everything in it below") and the HTML
  list still works. The page never shows a blank panel.
- **Analytics:** `homelab_device_selected` (device id) and
  `homelab_view_toggled` (view). `analytics.js` keeps its `capture` helper
  private, so the scene module calls `window.posthog.capture` itself with the
  same guard (`if (window.posthog)`, resolved at call time), and does nothing
  when analytics is off.

## 8. Testing and review

- `JEKYLL_ENV=production jekyll build --strict_front_matter`,
  `check-build.sh`, `check-build-test.sh`, and the `--future` build.
- Playwright: rack and network views at 1280px and 390px, light and dark;
  hover/select a device; toggle views; no console errors; no horizontal
  overflow; WebGL-disabled fallback renders the note and list.
- Grep the built page for `10.10.`, `100.`-range addresses, `tailscale`,
  hostnames: none present.
- Screenshots shared with Diyaz for approval **before** the PR is merged.

## 9. Out of scope

- Live data (real temperatures, node status) — would need a public endpoint
  into the lab.
- A Blender/GLB model.
- Adding the page to the nav.
