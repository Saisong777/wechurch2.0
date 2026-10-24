import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { buildCastleWorld, BUILDING_FOOTPRINTS, WALK_EDGES, WALK_NODES, WORLD_PLACES } from './world';

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
  it('creates all seven real mesh destinations and only explicitly supplied articulated residents without scene image textures', () => {
    const world = buildCastleWorld();
    expect(Object.keys(world.places)).toEqual(Object.keys(WORLD_PLACES));
    for (const [id, group] of Object.entries(world.places)) {
      expect(group.userData.placeId).toBe(id);
      expect(group.children.some(child => child instanceof THREE.Mesh)).toBe(true);
    }
    expect(world.residentCount).toBe(0);
    world.setPresence([{avatarId:'test-person',alias:'同行者',preset:'jade',isSelf:true,motion:{sequence:0,path:[[0,15]],startedAt:0,durationMs:0}}],0,0);expect(world.residentCount).toBe(1);
    for (const walker of world.walkers) { expect(walker.arms).toHaveLength(2); expect(walker.legs).toHaveLength(2); expect(walker.group.children.length).toBeGreaterThan(7); }
    let meshCount = 0;
    world.group.traverse(object => { if (object instanceof THREE.Mesh) { meshCount++; const material = object.material as THREE.MeshStandardMaterial; expect(material.map).toBeNull(); } });
    expect(meshCount).toBeGreaterThan(50); // Static meshes are batched; people retain their joint hierarchy.
    expect(meshCount).toBeLessThan(450);
    world.dispose();
  });
  it('interpolates only authoritative motion and removes departed residents without rebuilding scenery',()=>{
    const world=buildCastleWorld();const places=world.places;
    world.setPresence([{avatarId:'a',alias:'同行者',preset:'jade',isSelf:true,motion:{sequence:1,path:[[0,15],[0,10.5]],startedAt:1000,durationMs:3000}}],1000,0);
    const person=world.walkers[0];world.updateResidents(1500,true);expect(person.group.position.z).toBeCloseTo(12.75);expect(person.legs[0].rotation.x).not.toBe(0);
    world.updateResidents(1500,false);expect(Math.abs(person.legs[0].rotation.x)).toBe(0);expect(person.group.position.z).toBeCloseTo(12.75);
    world.setPresence([],2000,1500);expect(world.walkers).toEqual([]);expect(world.places).toBe(places);expect(person.group.parent).toBeNull();world.dispose();
  });
  it('disposes geometry and materials when the scene owner unmounts', () => {
    const world = buildCastleWorld(), geometry = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose'), material = vi.spyOn(THREE.Material.prototype, 'dispose');
    world.dispose(); expect(geometry).toHaveBeenCalled(); expect(material).toHaveBeenCalled(); vi.restoreAllMocks();
  });
});
