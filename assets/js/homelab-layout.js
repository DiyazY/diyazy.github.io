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
const LAYER_WIDTH = 9;          // widest a topology layer may spread

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
// uplink, as a layered tree. Each layer is ordered by its parents' x (then
// data order), so branches don't cross. Centred vertically on 0.
export function topologyLayout(devices) {
  const linked = devices.filter(d => d.uplink);
  const out = new Map([['internet', { x: 0, y: 0, z: 0 }]]);
  let layer = ['internet'];
  let depth = 0;
  while (layer.length) {
    depth += 1;
    const parentX = new Map(layer.map(id => [id, out.get(id).x]));
    const next = linked
      .filter(d => parentX.has(d.uplink))
      .map((d, i) => ({ d, i }))
      .sort((a, b) => parentX.get(a.d.uplink) - parentX.get(b.d.uplink) || a.i - b.i)
      .map(({ d }) => d.id);
    const xs = spread(next.length, Math.min(LAYER_WIDTH, next.length * 1.3));
    next.forEach((id, i) => out.set(id, { x: xs[i], y: -depth * LAYER_GAP, z: 0 }));
    layer = next;
  }
  const yValues = [...out.values()].map(p => p.y);
  const shift = -(Math.max(...yValues) + Math.min(...yValues)) / 2;
  for (const p of out.values()) p.y += shift;
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
