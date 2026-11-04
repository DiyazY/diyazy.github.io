// Layout maths for the home-lab scene: where each device sits in the rack and
// in the network view, and which links to draw. Pure functions over the
// device list from _data/homelab.yml, no DOM and no Three.js, so they are
// unit-tested in .github/scripts/homelab-test/.

// Shelves, top to bottom. "cooling" is not a shelf: it sits on the roof.
export const TIERS = ['network', 'servers', 'gpu', 'pis', 'storage'];
const ALL_TIERS = [...TIERS, 'cooling'];

export const SHELF_GAP = 1.1;   // vertical distance between shelves
export const SHELF_WIDTH = 6;   // usable shelf width; devices spread across it
export const LAYER_GAP = 1.4;   // vertical distance between topology layers
export const LEAF_GAP = 1.2;    // horizontal distance between neighbouring leaves

// Even spacing across `width`, centred on 0.
function spread(count, width) {
  if (count === 1) return [0];
  const step = width / count;
  return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * step);
}

// Throws on the same problems check-build.sh rejects, with the same messages.
export function validate(devices) {
  const byId = new Map();
  for (const d of devices) {
    if (byId.has(d.id)) throw new Error(`duplicate id ${d.id}`);
    byId.set(d.id, d);
  }
  for (const d of devices) {
    if (!ALL_TIERS.includes(d.tier)) throw new Error(`${d.id} has unknown tier ${d.tier}`);
    if (d.uplink && d.uplink !== 'internet' && !byId.has(d.uplink)) {
      throw new Error(`${d.id} uplink ${d.uplink} not found`);
    }
  }
  for (const d of devices) {
    const seen = new Set();
    for (let cur = d; cur && cur.uplink && cur.uplink !== 'internet'; cur = byId.get(cur.uplink)) {
      if (seen.has(cur.id)) throw new Error(`uplink cycle at ${d.id}`);
      seen.add(cur.id);
    }
  }
}

// Map<id, {x, y, z}> for every device: one shelf per tier, devices spread
// left to right in data order; cooling on the roof above the top shelf.
export function rackLayout(devices) {
  const out = new Map();
  for (const tier of ALL_TIERS) {
    const row = devices.filter(d => d.tier === tier);
    const y = tier === 'cooling'
      ? TIERS.length * SHELF_GAP
      : (TIERS.length - 1 - TIERS.indexOf(tier)) * SHELF_GAP;
    const xs = spread(row.length, SHELF_WIDTH);
    row.forEach((d, i) => out.set(d.id, { x: xs[i], y, z: 0 }));
  }
  return out;
}

// Map<id, {x, y, z}> for the virtual "internet" node and every device with an
// uplink, as a tidy tree: leaves get evenly spaced slots in depth-first (data)
// order, each parent sits centred over its children, so no links cross.
// Centred on 0 both ways.
export function topologyLayout(devices) {
  const linked = devices.filter(d => d.uplink);
  const children = (id) => linked.filter(d => d.uplink === id).map(d => d.id);
  const out = new Map();
  let slot = 0;
  (function place(id, depth) {
    const kids = children(id);
    kids.forEach(k => place(k, depth + 1));
    const x = kids.length
      ? kids.reduce((sum, k) => sum + out.get(k).x, 0) / kids.length
      : slot++ * LEAF_GAP;
    out.set(id, { x, y: -depth * LAYER_GAP, z: 0 });
  })('internet', 0);
  const xs = [...out.values()].map(p => p.x);
  const ys = [...out.values()].map(p => p.y);
  const dx = -(Math.max(...xs) + Math.min(...xs)) / 2;
  const dy = -(Math.max(...ys) + Math.min(...ys)) / 2;
  for (const p of out.values()) { p.x += dx; p.y += dy; }
  return out;
}

// One link per device with an uplink, parent first.
export function topologyLinks(devices) {
  return devices
    .filter(d => d.uplink)
    .map(d => ({ from: d.uplink, to: d.id, kind: d.link === 'usb-c-40g' ? 'usb-c-40g' : 'ethernet' }));
}

// Cubic ease-in-out; t is clamped to [0, 1].
export function easeInOut(t) {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

export function lerp3(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}
