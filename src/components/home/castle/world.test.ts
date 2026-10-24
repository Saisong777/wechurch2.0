import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { advanceWalker, buildCastleWorld, BUILDING_FOOTPRINTS, WALK_EDGES, WALK_NODES, WORLD_PLACES } from './world';

describe('miniature castle world', () => {
  it('keeps every full walking edge outside actual building footprints with a body margin', () => {
    for (const [from, to] of WALK_EDGES) {
      const a = WALK_NODES[from], b = WALK_NODES[to];
      for (let step = 0; step <= 300; step++) {
        const t = step / 300, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        for (const footprint of BUILDING_FOOTPRINTS) {
          const intersects = Math.abs(x - footprint.x) < footprint.halfX + .3 && Math.abs(z - footprint.z) < footprint.halfZ + .3;
          expect(intersects, `edge ${from}→${to} at ${x},${z} must avoid ${footprint.id}`).toBe(false);
        }
        expect((x / 21) ** 2 + (z / 17) ** 2).toBeLessThan(1);
      }
    }
  });
  it('keeps residents clear of the actual transformed tree, bench and lamp mesh bounds', () => {
    const world = buildCastleWorld();
    const collisions = new Set<string>();
    for (const [from, to] of WALK_EDGES) for (let step = 0; step <= 100; step++) {
      const t = step / 100, a = WALK_NODES[from], b = WALK_NODES[to];
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      for (const { kind, box } of world.obstacleBounds) {
        const intersects = box.max.y >= .3 && box.min.y <= 1.8 && x > box.min.x - .3 && x < box.max.x + .3 && z > box.min.z - .3 && z < box.max.z + .3;
        if (intersects) collisions.add(`edge ${from}→${to} hits ${kind}`);
      }
    }
    expect([...collisions]).toEqual([]);
    world.dispose();
  });
  it('creates all seven real mesh destinations and sixteen articulated residents without scene image textures', () => {
    const world = buildCastleWorld();
    expect(Object.keys(world.places)).toEqual(Object.keys(WORLD_PLACES));
    for (const [id, group] of Object.entries(world.places)) {
      expect(group.userData.placeId).toBe(id);
      expect(group.children.some(child => child instanceof THREE.Mesh)).toBe(true);
    }
    expect(world.residentCount).toBe(16);
    for (const walker of world.walkers) { expect(walker.arms).toHaveLength(2); expect(walker.legs).toHaveLength(2); expect(walker.group.children.length).toBeGreaterThan(7); }
    let meshCount = 0;
    world.group.traverse(object => { if (object instanceof THREE.Mesh) { meshCount++; const material = object.material as THREE.MeshStandardMaterial; expect(material.map).toBeNull(); } });
    expect(meshCount).toBeGreaterThan(200); // Static meshes are batched; people retain their joint hierarchy.
    expect(meshCount).toBeLessThan(450);
    world.dispose();
  });
  it('moves residents along graph edges, swings legs, and clamps a long background delta', () => {
    const world = buildCastleWorld(), person = world.walkers[0];
    const start = person.group.position.clone();
    world.update(90);
    expect(start.distanceTo(person.group.position)).toBeLessThan(.08);
    expect(start.distanceTo(person.group.position)).toBeGreaterThan(0);
    expect(person.legs[0].rotation.x).not.toBe(0);
    const state = { from: 0, to: 1, progress: .99, speed: 1, seed: 11 };
    for (let i = 0; i < 1000; i++) advanceWalker(state, .05);
    expect(state.progress).toBeGreaterThanOrEqual(0); expect(state.progress).toBeLessThan(1);
    expect(WALK_EDGES.some(([a, b]) => (a === state.from && b === state.to) || (a === state.to && b === state.from))).toBe(true);
    world.dispose();
  });
  it('disposes geometry and materials when the scene owner unmounts', () => {
    const world = buildCastleWorld(), geometry = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose'), material = vi.spyOn(THREE.Material.prototype, 'dispose');
    world.dispose(); expect(geometry).toHaveBeenCalled(); expect(material).toHaveBeenCalled(); vi.restoreAllMocks();
  });
});
