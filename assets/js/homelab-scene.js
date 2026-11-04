// 3D view of the home lab on /homelab.html.
//
// Reads the device list that homelab.html embeds from _data/homelab.yml,
// builds a low-poly cabinet with Three.js, and wires up orbiting. The page's
// HTML device list is the real content; this module only adds the 3D view on
// top, and shows a note instead if Three.js or WebGL is unavailable.
//
// Three.js is pinned in the page's import map and loaded with a dynamic
// import, so a blocked CDN lands in the fallback instead of an uncaught error.
//
// State the page and tests can read lives on the container's data attributes:
//   data-ready     "true" after the first frame, "fallback" if 3D failed
//   data-view      "rack" | "network"
//   data-settled   "true" when no view transition is running
//   data-motion    "full" | "reduced" (prefers-reduced-motion)
import {
  SHELF_GAP, SHELF_WIDTH, TIERS, easeInOut, lerp3, rackLayout, topologyLayout, topologyLinks, validate,
} from './homelab-layout.js';

const container = document.getElementById('homelab-scene');
const fallback = container.querySelector('.homelab-fallback');
const controlsBar = container.querySelector('.homelab-controls');
const data = JSON.parse(document.getElementById('homelab-data').textContent);
const devices = data.devices;

const GOLD = 0xc9a227;
const ROOF_Y = TIERS.length * SHELF_GAP;
const CABINET = { width: SHELF_WIDTH + 0.6, depth: 1.7, bottom: -0.12, top: ROOF_Y };
const RACK_TARGET = { x: 0, y: ROOF_Y / 2, z: 0 };

// Size and colour per kind: [width, height, depth], body colour.
const KINDS = {
  nuc: { size: [1.1, 0.5, 1.1], color: 0x4a4f56 },
  jetson: { size: [1.0, 0.38, 0.9], color: 0x2c2d2f },
  seeed: { size: [1.0, 0.38, 0.9], color: 0x232426 },
  pi4: { size: [0.66, 0.26, 0.6], color: 0xa9483e },
  pi3: { size: [0.66, 0.22, 0.6], color: 0x3e6b52 },
  'pi-zero': { size: [0.56, 0.12, 0.3], color: 0x3e6b52 },
  switch: { size: [1.6, 0.26, 0.8], color: 0x50555b },
  router: { size: [0.9, 0.62, 0.9], color: 0xe9e5dd },
  nas: { size: [1.0, 0.95, 1.2], color: 0x2f3135 },
  fan: { size: [0.95, 0.22, 0.95], color: 0xb08b6a },
  ruuvi: { size: [0.36, 0.07, 0.36], color: 0xf1eee8 },
};

const state = {
  view: 'rack',
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
};

function showFallback() {
  fallback.removeAttribute('data-loading');
  fallback.textContent = 'The 3D view needs WebGL — here’s everything in it below.';
  fallback.hidden = false;
  controlsBar.hidden = true;
  container.dataset.ready = 'fallback';
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function start() {
  validate(devices);
  if (!webglAvailable()) throw new Error('WebGL unavailable');

  const [THREE, { OrbitControls }, { CSS2DRenderer, CSS2DObject }] = await Promise.all([
    import('three'),
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/renderers/CSS2DRenderer.js'),
  ]);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x2a2521, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(4, 9, 7);
  scene.add(sun);

  // --- cabinet -------------------------------------------------------------
  const cabinet = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xa9aeac, roughness: 0.55, metalness: 0.3 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x5b605f, roughness: 0.8 });
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2d, roughness: 0.8 });
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    cabinet.add(m);
    return m;
  };
  const { width: W, depth: D, bottom: B, top: T } = CABINET;
  const H = T - B;
  for (const sx of [-1, 1]) {
    box(0.08, H, D, steel, sx * (W / 2), B + H / 2, 0);            // side panels
  }
  box(W + 0.08, 0.08, D, steel, 0, T, 0);                          // roof
  box(W + 0.08, 0.1, D, steel, 0, B, 0);                           // base
  box(W, H, 0.04, backMat, 0, B + H / 2, -D / 2);                  // back
  TIERS.forEach((tier, i) => {
    const y = (TIERS.length - 1 - i) * SHELF_GAP;
    box(W - 0.04, 0.05, D - 0.1, shelfMat, 0, y - 0.03, 0);
  });
  scene.add(cabinet);

  // Soft contact shadow under the cabinet.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  shadow.scale.set(W * 0.62, D * 0.9, 1);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = B - 0.06;
  scene.add(shadow);

  // --- devices -------------------------------------------------------------
  const meshes = new Map();
  const leds = [];
  const rotors = [];

  function buildDevice(d) {
    const spec = KINDS[d.kind];
    const [w, h, dep] = spec.size;
    const group = new THREE.Group();
    group.userData.id = d.id;
    const mat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.65, metalness: 0.15 });

    if (d.kind === 'router' || d.kind === 'ruuvi') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, h, 32), mat);
      body.position.y = h / 2;
      group.add(body);
    } else if (d.kind === 'fan') {
      const frame = new THREE.Mesh(new THREE.TorusGeometry(w / 2 - 0.06, 0.06, 10, 32), mat);
      frame.rotation.x = Math.PI / 2;
      frame.position.y = h / 2;
      const rotor = new THREE.Group();
      rotor.position.y = h / 2;
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.7 });
      for (let i = 0; i < 7; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(w / 2 - 0.12, 0.02, 0.12), bladeMat);
        blade.position.x = (w / 2 - 0.12) / 2;
        const arm = new THREE.Group();
        arm.rotation.y = (i / 7) * Math.PI * 2;
        blade.rotation.x = 0.35;
        arm.add(blade);
        rotor.add(arm);
      }
      rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), bladeMat));
      group.add(frame, rotor);
      rotors.push(rotor);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), mat);
      body.position.y = h / 2;
      group.add(body);
    }

    // Status LED on the front of anything on the network.
    if (d.uplink) {
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 1.5, userData: { led: true } }),
      );
      led.position.set(w / 2 - 0.12, Math.min(h * 0.6, h - 0.05), dep / 2 + 0.01);
      if (d.kind === 'router') led.position.set(0, h * 0.75, w / 2 + 0.01);
      led.userData.phase = Math.random() * Math.PI * 2;
      group.add(led);
      leds.push(led);
    }
    return group;
  }

  const rack = rackLayout(devices);
  for (const d of devices) {
    const g = buildDevice(d);
    const p = rack.get(d.id);
    g.position.set(p.x, p.y, p.z);
    scene.add(g);
    meshes.set(d.id, g);
  }

  // --- camera and controls ---------------------------------------------------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = 1.45;
  controls.minAzimuthAngle = -1.2;
  controls.maxAzimuthAngle = 1.2;
  controls.minDistance = 6;
  controls.maxDistance = 30;
  controls.autoRotateSpeed = 0.4;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  // Distance that fits a width x height box in view at the current aspect.
  function fitDistance(width, height) {
    const v = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    return Math.max(height / (2 * v), width / (2 * v * camera.aspect)) * 1.3;
  }

  // Where the camera rests in each view: {position, target}.
  // In portrait viewports the network tree is drawn left to right instead of
  // top to bottom (see setupNetworkView), so its bounding box turns too.
  const NETWORK_SIZE = { width: 13.5, height: 7 };
  function cameraFor(view) {
    const target = new THREE.Vector3(RACK_TARGET.x, RACK_TARGET.y, RACK_TARGET.z);
    if (view === 'network') {
      const dist = portrait()
        ? fitDistance(NETWORK_SIZE.height, NETWORK_SIZE.width)
        : fitDistance(NETWORK_SIZE.width, NETWORK_SIZE.height);
      return { position: new THREE.Vector3(0, target.y + dist * 0.12, dist), target };
    }
    const dist = fitDistance(W + 1, H + 1.6);
    return { position: new THREE.Vector3(dist * 0.3, target.y + dist * 0.32, dist * 0.9), target };
  }

  function resetCamera() {
    const { position, target } = cameraFor(state.view);
    controls.target.copy(target);
    camera.position.copy(position);
    controls.autoRotate = state.view === 'rack' && !state.reducedMotion;
    controls.update();
  }

  // --- theme, motion, size ---------------------------------------------------
  function applyTheme() {
    const bg = getComputedStyle(container).getPropertyValue('--homelab-bg').trim() || '#2a2521';
    scene.background = new THREE.Color(bg);
  }
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  function applyMotion() {
    container.dataset.motion = state.reducedMotion ? 'reduced' : 'full';
    controls.autoRotate = controls.autoRotate && !state.reducedMotion;
  }
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    state.reducedMotion = e.matches;
    applyMotion();
  });
  applyMotion();

  let firstSize = true;
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (firstSize) { firstSize = false; resetCamera(); }
  }
  new ResizeObserver(resize).observe(container);
  resize();

  document.getElementById('homelab-reset').addEventListener('click', resetCamera);

  // --- render loop, only while visible --------------------------------------
  const timer = new THREE.Timer();
  let onScreen = true;
  let frame = 0;

  function tick(now) {
    frame = 0;
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1);
    const t = timer.getElapsed();
    if (!state.reducedMotion) {
      for (const r of rotors) r.rotation.y += dt * 9;
      for (const led of leds) led.material.emissiveIntensity = 0.8 + 0.8 * (0.5 + 0.5 * Math.sin(t * 3 + led.userData.phase));
    }
    for (const fn of frameHooks) fn(dt, t);
    controls.update();
    renderer.render(scene, camera);
    for (const fn of afterRenderHooks) fn();
    if (container.dataset.ready !== 'true') container.dataset.ready = 'true';
    schedule();
  }
  function schedule() {
    if (!frame && onScreen && !document.hidden) frame = requestAnimationFrame(tick);
  }
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) schedule();
  }).observe(container);
  document.addEventListener('visibilitychange', schedule);

  fallback.hidden = true;
  controlsBar.hidden = false;
  schedule();

  const ctx = { THREE, CSS2DRenderer, CSS2DObject, scene, camera, renderer, controls, meshes, cabinet, shadow, cameraFor, rack };
  ctx.select = setupInteraction(ctx);
  setupNetworkView(ctx);
  return ctx;
}

// --- interaction: hover, select, info card, list sync -------------------------
const card = document.getElementById('homelab-card');
const listButtons = [...document.querySelectorAll('.homelab-device')];
const byId = new Map(devices.map(d => [d.id, d]));
const DRAG_PX = 5; // pointer travel beyond this is an orbit drag, not a tap

function capture(event, props) {
  if (window.posthog) window.posthog.capture(event, props);
}

function el(tag, text, className) {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  if (className) n.className = className;
  return n;
}

function fillCard(d) {
  card.replaceChildren();
  const close = el('button', '\u00d7', 'card-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  card.append(close, el('h3', d.name), el('p', `${d.model} \u00b7 ${d.specs}`, 'card-model'), el('p', d.role, 'card-role'));
  if (d.services && d.services.length) {
    const ul = el('ul');
    for (const s of d.services) ul.append(el('li', s));
    card.append(ul);
  }
  for (const link of d.links || []) {
    const a = el('a', link.label);
    a.href = link.url;
    const p = el('p');
    p.append(a);
    card.append(p);
  }
  return close;
}

function setupInteraction({ THREE, camera, renderer, controls, meshes }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groups = [...meshes.values()];
  let hovered = null;
  let selected = null;
  let down = null;
  let targetTween = null;

  function glow(id, on) {
    const g = meshes.get(id);
    if (!g) return;
    g.traverse((o) => {
      if (!o.isMesh || o.material.userData.led) return;
      if (!o.material.userData.own) { o.material = o.material.clone(); o.material.userData.own = true; }
      o.material.emissive.setHex(on ? 0xc9a227 : 0x000000);
      o.material.emissiveIntensity = on ? 0.35 : 0;
    });
  }
  const lit = () => { for (const id of meshes.keys()) glow(id, id === hovered || id === selected); };

  function pick(event) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    for (const hit of raycaster.intersectObjects(groups, true)) {
      let o = hit.object;
      while (o && !o.userData.id) o = o.parent;
      if (o && o.visible && !o.userData.hidden) return o.userData.id;
    }
    return null;
  }

  function select(id, { source = 'scene' } = {}) {
    selected = id && byId.has(id) ? id : null;
    container.dataset.selected = selected || '';
    for (const b of listButtons) b.setAttribute('aria-pressed', String(b.dataset.device === selected));
    if (selected) {
      fillCard(byId.get(selected)).addEventListener('click', () => select(null));
      card.hidden = false;
      capture('homelab_device_selected', { device: selected });
      if (source === 'list') {
        const p = meshes.get(selected).position;
        targetTween = { from: controls.target.clone(), to: new THREE.Vector3(p.x, p.y, p.z), t: 0 };
        if (state.reducedMotion) { controls.target.copy(targetTween.to); targetTween = null; }
      }
    } else {
      card.hidden = true;
      card.replaceChildren();
    }
    lit();
  }

  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const id = pick(e);
    if (id !== hovered) { hovered = id; canvas.style.cursor = id ? 'pointer' : ''; lit(); }
  });
  canvas.addEventListener('pointerleave', () => { hovered = null; canvas.style.cursor = ''; lit(); });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > DRAG_PX) return;
    select(pick(e));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && selected) select(null); });

  for (const b of listButtons) {
    b.addEventListener('click', () => {
      const id = b.dataset.device;
      select(selected === id ? null : id, { source: 'list' });
      if (selected) container.scrollIntoView({ behavior: state.reducedMotion ? 'auto' : 'smooth', block: 'center' });
    });
  }

  frameHooks.push((dt) => {
    if (!targetTween) return;
    targetTween.t = Math.min(1, targetTween.t + dt / 0.6);
    controls.target.lerpVectors(targetTween.from, targetTween.to, targetTween.t * targetTween.t * (3 - 2 * targetTween.t));
    if (targetTween.t === 1) targetTween = null;
  });

  // Test hook for local Playwright checks only; never exposed on the live site.
  if (location.hostname === 'localhost') {
    window.__homelabProject = (id) => {
      const g = meshes.get(id);
      if (!g) return null;
      const box = new THREE.Box3().setFromObject(g);
      const v = box.getCenter(new THREE.Vector3()).project(camera);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    };
  }
  return select;
}

// --- network view: devices rearrange into the topology ------------------------
const TWEEN_S = 1.2;
const portrait = () => container.clientWidth < container.clientHeight * 0.9;

function setupNetworkView({ THREE, CSS2DRenderer, CSS2DObject, scene, camera, controls, meshes, cabinet, shadow, cameraFor, rack }) {
  const topo = topologyLayout(devices);
  const links = topologyLinks(devices);
  // Portrait: rotate the tree a quarter turn so it flows left to right.
  const lift = (p) => (portrait()
    ? { x: -p.y, y: -p.x + RACK_TARGET.y, z: p.z }
    : { x: p.x, y: p.y + RACK_TARGET.y, z: p.z });
  const height = (id) => (byId.has(id) ? KINDS[byId.get(id).kind].size[1] : 0);

  // Internet: a gold wireframe ball, only in the network view.
  const internet = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.35, 1),
    new THREE.MeshBasicMaterial({ color: GOLD, wireframe: true, transparent: true, opacity: 0 }),
  );
  const placeInternet = () => { const ip = lift(topo.get('internet')); internet.position.set(ip.x, ip.y, ip.z); };
  placeInternet();
  internet.visible = false;
  scene.add(internet);

  // Everything that fades out in the network view: cabinet, shadow, and the
  // devices with no place in the topology (fans, sensor).
  const fading = [cabinet, shadow, ...devices.filter(d => !topo.has(d.id)).map(d => meshes.get(d.id))];
  const fadeMats = [];
  for (const o of fading) {
    o.traverse((m) => {
      if (!m.isMesh) return;
      if (!m.material.userData.own) { m.material = m.material.clone(); m.material.userData.own = true; }
      m.material.transparent = true;
      fadeMats.push({ mat: m.material, base: m.material.opacity });
    });
  }

  // Links: thin cylinders re-laid every frame between the two device centres.
  const center = (id) => {
    if (id === 'internet') return internet.position.clone();
    const g = meshes.get(id);
    return g.position.clone().add(new THREE.Vector3(0, height(id) / 2, 0));
  };
  const up = new THREE.Vector3(0, 1, 0);
  const linkObjs = links.map((l) => {
    const usb = l.kind === 'usb-c-40g';
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(usb ? 0.05 : 0.018, usb ? 0.05 : 0.018, 1, 8),
      new THREE.MeshBasicMaterial({ color: usb ? GOLD : 0x9c8a5c, transparent: true, opacity: 0 }),
    );
    mesh.visible = false;
    scene.add(mesh);
    const packets = [0, 1].map((i) => {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(usb ? 0.06 : 0.045, 10, 10),
        new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0 }),
      );
      p.visible = false;
      p.userData = { reverse: i === 1, period: usb ? 0.8 : 1.8 + Math.random() * 1.2, phase: Math.random() };
      scene.add(p);
      return p;
    });
    return { ...l, usb, mesh, packets };
  });

  // Labels: device names in the network view, plus the USB-C link.
  const labelRenderer = new CSS2DRenderer();
  // isolation keeps the renderer's per-label z-indexes inside this layer, so
  // labels never draw over the info card or the controls.
  Object.assign(labelRenderer.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none', isolation: 'isolate', zIndex: '0' });
  container.insertBefore(labelRenderer.domElement, container.querySelector('.homelab-controls'));
  const labels = [];
  const addLabel = (text, parent, y, extra = '') => {
    const div = el('div', text, `homelab-label ${extra}`.trim());
    const obj = new CSS2DObject(div);
    obj.position.set(0, y, 0);
    obj.visible = false;
    parent.add(obj);
    labels.push(obj);
    return obj;
  };
  addLabel('Internet', internet, 0.6);
  for (const d of devices) if (topo.has(d.id)) addLabel(d.short || d.name, meshes.get(d.id), height(d.id) + 0.28);
  const usbLink = linkObjs.find(l => l.usb);
  const usbLabel = usbLink ? addLabel('40 Gbps USB-C', usbLink.mesh, 0, 'homelab-label--link') : null;
  if (usbLabel) usbLabel.position.set(0.75, 0, 0);

  // Re-lay the network view if the viewport flips between portrait and
  // landscape while it is showing.
  let wasPortrait = portrait();
  const onResize = () => {
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    if (portrait() !== wasPortrait) {
      wasPortrait = portrait();
      placeInternet();
      if (state.view === 'network') setView('network', { quiet: true });
    }
  };
  new ResizeObserver(onResize).observe(container);
  onResize();

  // fade: 0 = rack view, 1 = network view. Every transition starts from the
  // current positions and fade, so toggling mid-way just turns around.
  let fade = 0;
  let tween = null;

  function applyFade(f) {
    for (const { mat, base } of fadeMats) mat.opacity = base * (1 - f);
    for (const o of fading) { o.visible = f < 0.999; o.userData.hidden = f > 0.5; }
    internet.visible = f > 0.001;
    internet.material.opacity = f;
    for (const l of linkObjs) { l.mesh.visible = f > 0.001; l.mesh.material.opacity = (l.usb ? 1 : 0.75) * f; }
  }

  function targetsFor(view) {
    const out = new Map();
    for (const d of devices) {
      const p = view === 'network' && topo.has(d.id) ? lift(topo.get(d.id)) : rack.get(d.id);
      out.set(d.id, p);
    }
    return out;
  }

  function setView(view, { quiet = false } = {}) {
    if (view !== 'rack' && view !== 'network') return;
    state.view = view;
    container.dataset.view = view;
    for (const b of container.querySelectorAll('.homelab-toggle [data-view]')) {
      b.setAttribute('aria-pressed', String(b.dataset.view === view));
    }
    for (const l of labels) l.visible = view === 'network';
    controls.autoRotate = false;
    const cam = cameraFor(view);
    tween = {
      t: 0,
      from: new Map([...meshes].map(([id, g]) => [id, g.position.clone()])),
      to: targetsFor(view),
      fadeFrom: fade,
      fadeTo: view === 'network' ? 1 : 0,
      camFrom: camera.position.clone(),
      camTo: cam.position,
      targetFrom: controls.target.clone(),
      targetTo: cam.target,
    };
    container.dataset.settled = 'false';
    if (state.reducedMotion) step(TWEEN_S);
    if (!quiet) capture('homelab_view_toggled', { view });
  }

  function step(dt) {
    if (!tween) return;
    tween.t = Math.min(1, tween.t + dt / TWEEN_S);
    const k = easeInOut(tween.t);
    for (const [id, g] of meshes) {
      const p = lerp3(tween.from.get(id), tween.to.get(id), k);
      g.position.set(p.x, p.y, p.z);
    }
    fade = tween.fadeFrom + (tween.fadeTo - tween.fadeFrom) * k;
    applyFade(fade);
    camera.position.lerpVectors(tween.camFrom, tween.camTo, k);
    controls.target.lerpVectors(tween.targetFrom, tween.targetTo, k);
    if (tween.t === 1) {
      tween = null;
      container.dataset.settled = 'true';
    }
  }

  const tmp = new THREE.Vector3();
  frameHooks.push((dt, t) => {
    step(dt);
    if (fade <= 0.001) return;
    for (const l of linkObjs) {
      const a = center(l.from);
      const b = center(l.to);
      const len = a.distanceTo(b);
      l.mesh.position.copy(a).add(b).multiplyScalar(0.5);
      l.mesh.scale.set(1, len, 1);
      l.mesh.quaternion.setFromUnitVectors(up, tmp.copy(b).sub(a).normalize());
      for (const p of l.packets) {
        const on = state.view === 'network' && !state.reducedMotion;
        p.visible = on;
        if (!on) continue;
        let u = ((t / p.userData.period) + p.userData.phase) % 1;
        if (p.userData.reverse) u = 1 - u;
        p.position.lerpVectors(a, b, u);
        p.material.opacity = fade * Math.sin(Math.PI * u);
      }
    }
  });
  afterRenderHooks.push(() => labelRenderer.render(scene, camera));

  for (const b of container.querySelectorAll('.homelab-toggle [data-view]')) {
    b.addEventListener('click', () => setView(b.dataset.view));
  }

  if (location.hostname === 'localhost') {
    window.__homelabPosition = (id) => {
      const g = meshes.get(id);
      return g ? { x: g.position.x, y: g.position.y, z: g.position.z } : null;
    };
  }
}

// Per-frame callbacks registered by the interaction and network-view code.
const frameHooks = [];
const afterRenderHooks = [];

start().catch((err) => {
  console.info('[homelab] 3D view unavailable:', err.message);
  showFallback();
});
