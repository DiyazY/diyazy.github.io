// Unit tests for assets/js/homelab-layout.js (no DOM, no Three.js).
// Run: node --test '.github/scripts/homelab-test/*.test.mjs'
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIERS, LAYER_GAP, LEAF_GAP, rackLayout, topologyLayout, topologyLinks, validate, easeInOut, lerp3,
} from '../../../assets/js/homelab-layout.js';

const devices = [
  { id: 'router', tier: 'network', kind: 'router', uplink: 'internet' },
  { id: 'switch', tier: 'network', kind: 'switch', uplink: 'router' },
  { id: 'nuc-1', tier: 'servers', kind: 'nuc', uplink: 'switch' },
  { id: 'nuc-2', tier: 'servers', kind: 'nuc', uplink: 'switch' },
  { id: 'ruuvi', tier: 'servers', kind: 'ruuvi' },
  { id: 'jetson', tier: 'gpu', kind: 'jetson', uplink: 'switch' },
  { id: 'seeed', tier: 'gpu', kind: 'seeed', uplink: 'jetson', link: 'usb-c-40g' },
  { id: 'fan', tier: 'cooling', kind: 'fan' },
];
const ys = (layout, tier) => devices.filter(d => d.tier === tier).map(d => layout.get(d.id).y);

test('rackLayout places every device', () => {
  assert.equal(rackLayout(devices).size, devices.length);
});

test('tiers stack top to bottom with cooling on the roof', () => {
  const l = rackLayout(devices);
  assert.ok(Math.min(...ys(l, 'network')) > Math.max(...ys(l, 'servers')));
  assert.ok(Math.min(...ys(l, 'servers')) > Math.max(...ys(l, 'gpu')));
  const others = devices.filter(d => d.tier !== 'cooling').map(d => l.get(d.id).y);
  assert.ok(l.get('fan').y > Math.max(...others));
  assert.deepEqual(TIERS, ['network', 'servers', 'gpu', 'pis', 'storage']);
});

test('devices in a tier are centred and distinct', () => {
  const l = rackLayout(devices);
  for (const tier of ['network', 'servers', 'gpu']) {
    const xs = devices.filter(d => d.tier === tier).map(d => l.get(d.id).x);
    assert.equal(new Set(xs).size, xs.length);
    assert.ok(Math.abs(xs.reduce((a, b) => a + b, 0) / xs.length) < 1e-9);
  }
});

test('topology starts at internet and leaves out unlinked devices', () => {
  const l = topologyLayout(devices);
  assert.ok(l.has('internet'));
  for (const [id, p] of l) if (id !== 'internet') assert.ok(l.get('internet').y > p.y);
  assert.equal(l.has('fan'), false);
  assert.equal(l.has('ruuvi'), false);
});

test('children sit one layer below their uplink', () => {
  const l = topologyLayout(devices);
  for (const { from, to } of topologyLinks(devices)) {
    assert.ok(Math.abs(l.get(from).y - l.get(to).y - LAYER_GAP) < 1e-9, `${from}->${to}`);
  }
});

test('topology is vertically centred', () => {
  const l = topologyLayout(devices);
  const y = [...l.values()].map(p => p.y);
  assert.ok(Math.abs(Math.max(...y) + Math.min(...y)) < 1e-9);
});

test('leaves are spaced LEAF_GAP apart in depth-first order', () => {
  const l = topologyLayout(devices);
  const xs = ['nuc-1', 'nuc-2', 'seeed'].map(id => l.get(id).x);
  assert.ok(Math.abs(xs[1] - xs[0] - LEAF_GAP) < 1e-9);
  assert.ok(Math.abs(xs[2] - xs[1] - LEAF_GAP) < 1e-9);
});

test('parents sit centred over their children', () => {
  const l = topologyLayout(devices);
  const kids = (id) => devices.filter(d => d.uplink === id).map(d => l.get(d.id).x);
  for (const id of ['switch', 'jetson', 'router']) {
    const xs = kids(id);
    assert.ok(Math.abs(l.get(id).x - xs.reduce((a, b) => a + b, 0) / xs.length) < 1e-9, id);
  }
});

test('topology is horizontally centred', () => {
  const x = [...topologyLayout(devices).values()].map(p => p.x);
  assert.ok(Math.abs(Math.max(...x) + Math.min(...x)) < 1e-9);
});

test('usb-c link is typed', () => {
  const links = topologyLinks(devices);
  assert.equal(links.length, 6);
  assert.deepEqual(links.find(k => k.to === 'seeed'), { from: 'jetson', to: 'seeed', kind: 'usb-c-40g' });
  assert.ok(links.filter(k => k.to !== 'seeed').every(k => k.kind === 'ethernet'));
});

test('validate accepts good data', () => {
  assert.doesNotThrow(() => validate(devices));
});

test('validate rejects bad data', () => {
  const d = (id, tier, uplink) => ({ id, tier, kind: 'nuc', ...(uplink ? { uplink } : {}) });
  assert.throws(() => validate([d('a', 'servers', 'internet'), d('a', 'servers', 'internet')]), { message: 'duplicate id a' });
  assert.throws(() => validate([d('a', 'servers', 'nope')]), { message: 'a uplink nope not found' });
  assert.throws(() => validate([d('a', 'servers', 'b'), d('b', 'servers', 'a')]), { message: 'uplink cycle at a' });
  assert.throws(() => validate([d('a', 'attic', 'internet')]), { message: 'a has unknown tier attic' });
});

test('easeInOut endpoints and clamping', () => {
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.equal(easeInOut(0.5), 0.5);
  assert.equal(easeInOut(-1), 0);
  assert.equal(easeInOut(2), 1);
});

test('lerp3 interpolates each axis', () => {
  assert.deepEqual(lerp3({ x: 0, y: 2, z: -4 }, { x: 10, y: 4, z: 4 }, 0.5), { x: 5, y: 3, z: 0 });
});
