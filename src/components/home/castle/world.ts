import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const WORLD_PLACES = {
  chapel: { position: [0, 7.8, -5] as const, target: [0, 3, -5] as const, distance: 22 },
  bible: { position: [-13, 8.5, -6.5] as const, target: [-13, 3, -6.5] as const, distance: 17 },
  prayer: { position: [14, 3.7, -7] as const, target: [14, 1, -7] as const, distance: 16 },
  groups: { position: [-15, 4.6, 8] as const, target: [-15, 1, 8] as const, distance: 18 },
  grace: { position: [15, 5.8, 1] as const, target: [15, 2, 1] as const, distance: 17 },
  square: { position: [0, 2, 5.5] as const, target: [0, .5, 5.5] as const, distance: 18 },
  play: { position: [9, 4.7, 9] as const, target: [9, 1.3, 9] as const, distance: 16 },
};
export type PlaceId = keyof typeof WORLD_PLACES;
// Every edge is a walkable path outside the footprint of buildings and walls.
export const WALK_NODES = [
  [0, 15], [0, 10.5], [0, 5.5], [0, 1], [-6.5, 4], [-11, 4.5], [-15, 8.5],
  [-9.5, -2.5], [-8, -12], [0, -12], [10, -11], [10, -3], [12, 4.5], [16, 6.5], [9, 12.7], [13, 12.7],
] as const;
export const WALK_EDGES = [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 6], [5, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [12, 15], [15, 14], [14, 1], [12, 2]] as const;
export const BUILDING_FOOTPRINTS = [
  { id: 'castle', x: 0, z: -5.7, halfX: 5.4, halfZ: 4.7 },
  { id: 'tower', x: -13, z: -6.5, halfX: 2.3, halfZ: 2.3 },
  { id: 'library', x: 15, z: 1, halfX: 2.8, halfZ: 2.3 },
  { id: 'cottage-a', x: -17, z: 5, halfX: 1.6, halfZ: 1.45 },
  { id: 'cottage-b', x: -16.9, z: 8.3, halfX: 1.5, halfZ: 1.4 },
  { id: 'cottage-c', x: -11.5, z: 10.5, halfX: 1.6, halfZ: 1.45 },
  { id: 'fountain', x: 14, z: -7, halfX: 2.2, halfZ: 2.2 },
  { id: 'pavilion', x: 9, z: 9, halfX: 2.4, halfZ: 2.4 },
] as const;

export type WalkerState = { from: number; to: number; progress: number; speed: number; seed: number };
export function advanceWalker(state: WalkerState, delta: number) {
  let remaining = Math.min(.05, Math.max(0, delta)) * state.speed;
  while (remaining > 0) {
    const a = WALK_NODES[state.from], b = WALK_NODES[state.to];
    const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const travel = Math.min(remaining, (1 - state.progress) * length);
    state.progress += travel / length;
    remaining -= travel;
    if (state.progress >= 1 - 1e-8) {
      const options = WALK_EDGES.flatMap(([a, b]) => a === state.to ? [b] : b === state.to ? [a] : []).filter(n => n !== state.from);
      state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
      const next = options.length ? options[state.seed % options.length] : state.from;
      state.from = state.to; state.to = next; state.progress = 0;
    }
  }
  const a = WALK_NODES[state.from], b = WALK_NODES[state.to];
  return { x: THREE.MathUtils.lerp(a[0], b[0], state.progress), z: THREE.MathUtils.lerp(a[1], b[1], state.progress), angle: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}

export function buildCastleWorld() {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const geo = <T extends THREE.BufferGeometry>(g: T) => { geometries.add(g); return g; };
  const mat = (color: number, roughness = .85) => { const m = new THREE.MeshStandardMaterial({ color, roughness, flatShading: true }); materials.add(m); return m; };
  const stone = mat(0xf6ebd2), stoneLight = mat(0xfff8e5), stoneShade = mat(0xd8c5a0), gold = mat(0xdcae4c, .45);
  const jade = mat(0x287b70), jadeLight = mat(0x439887), coral = mat(0xd68164), dark = mat(0x354d4c), wood = mat(0x986a43), pathMat = mat(0xe8d7ad), windowMat = mat(0x75b6b4, .35);
  const grass = mat(0x91b869), foliage = [mat(0x3c8060), mat(0x59945b), mat(0x6ba263), mat(0x82aa59)];
  const rockMats = [mat(0xa8a793), mat(0xb9b49d), mat(0xc6bba3)];
  const world = new THREE.Group(), environment = new THREE.Group(); world.add(environment);
  const boxGeo = geo(new THREE.BoxGeometry(1, 1, 1)), cylinderGeo = geo(new THREE.CylinderGeometry(1, 1, 1, 12)), sphereGeo = geo(new THREE.IcosahedronGeometry(1, 1));
  const coneGeo = geo(new THREE.ConeGeometry(1, 1, 8));
  function mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, shadow = true) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  }
  const box = (p: THREE.Group, m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, shadow = true) => mesh(p, boxGeo, m, x, y, z, w, h, d, shadow);
  const cylinder = (p: THREE.Group, m: THREE.Material, x: number, y: number, z: number, r: number, h: number, shadow = true) => mesh(p, cylinderGeo, m, x, y, z, r, h, r, shadow);
  const ball = (p: THREE.Group, m: THREE.Material, x: number, y: number, z: number, r: number, sy = r, sz = r) => mesh(p, sphereGeo, m, x, y, z, r, sy, sz);
  function ridgeRoof(parent: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
    const shape = new THREE.Shape(); shape.moveTo(-w / 2, 0); shape.lineTo(0, h); shape.lineTo(w / 2, 0); shape.closePath();
    const geometry = geo(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }));
    return mesh(parent, geometry, material, x, y, z - d / 2);
  }
  function arch(parent: THREE.Group, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number) {
    const shape = new THREE.Shape(); shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(width / 2, height - width / 2); shape.absarc(0, height - width / 2, width / 2, 0, Math.PI, false); shape.lineTo(-width / 2, 0);
    return mesh(parent, geo(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 })), material, x, y, z);
  }
  function cross(parent: THREE.Group, x: number, y: number, z: number, scale = 1) { box(parent, gold, x, y, z, .13 * scale, 1.5 * scale, .13 * scale); box(parent, gold, x, y + .18 * scale, z, .9 * scale, .13 * scale, .13 * scale); }
  function windows(parent: THREE.Group, x: number, z: number, y: number, rotation = 0, size = 1) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotation; parent.add(g);
    arch(g, stoneShade, 0, 0, 0, .7 * size, 1.5 * size, .08);
    arch(g, windowMat, 0, .09, .09, .49 * size, 1.27 * size, .015);
    box(g, stoneLight, 0, .62 * size, .12, .06, 1.1 * size, .05); box(g, stoneLight, 0, .72 * size, .12, .5 * size, .055, .05);
  }
  function tower(parent: THREE.Group, x: number, z: number, height: number, radius: number, roofHeight: number) {
    cylinder(parent, stoneShade, x, .3, z, radius * 1.13, .6);
    cylinder(parent, stone, x, height / 2, z, radius, height);
    cylinder(parent, stoneShade, x, height - .3, z, radius * 1.05, .18);
    cylinder(parent, stoneLight, x, height + .15, z, radius * 1.16, .5);
    mesh(parent, coneGeo, jade, x, height + roofHeight / 2 + .4, z, radius * 1.35, roofHeight, radius * 1.35);
    ball(parent, gold, x, height + roofHeight + .5, z, .12);
    windows(parent, x, z + radius - .025, height - 2.3, 0, .8);
    windows(parent, x + radius - .025, z, height - 2.3, Math.PI / 2, .8);
  }
  function battlement(parent: THREE.Group, x: number, z: number, width: number, rotation = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotation; parent.add(g);
    box(g, stone, 0, 1.3, 0, width, 2.6, .6); box(g, stoneShade, 0, .25, .04, width + .12, .3, .73);
    box(g, stoneLight, 0, 2.65, 0, width + .12, .2, .78);
    const count = Math.round(width / .9); for (let i = 0; i < count; i++) box(g, stoneLight, -width / 2 + (i + .5) * width / count, 3, 0, .45, .65, .7);
  }
  function batch(group: THREE.Group) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, { geometries: THREE.BufferGeometry[]; shadow: boolean }>();
    const meshes: THREE.Mesh[] = [];
    group.traverse(object => { if (object instanceof THREE.Mesh && !Array.isArray(object.material)) {
      const g = object.geometry.clone(); g.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      // Extruded geometry may carry UVs; all primitive batches retain position/normal only.
      g.deleteAttribute('uv'); g.deleteAttribute('uv1'); const entry = batches.get(object.material) || { geometries: [], shadow: false };
      if (g.index) { entry.geometries.push(g.toNonIndexed()); g.dispose(); } else entry.geometries.push(g); entry.shadow ||= object.castShadow; batches.set(object.material, entry); meshes.push(object);
    } });
    for (const m of meshes) m.removeFromParent();
    for (const [material, entry] of batches) {
      const merged = mergeGeometries(entry.geometries, false); entry.geometries.forEach(g => g.dispose());
      if (merged) { const m = new THREE.Mesh(geo(merged), material); m.castShadow = entry.shadow; m.receiveShadow = true; group.add(m); }
    }
  }

  // An irregular layered limestone island, with the sea below the cliff edge.
  const islandGeo = geo(new THREE.CylinderGeometry(1, 1.045, 1, 72));
  const islandPositions = islandGeo.attributes.position;
  for (let i = 0; i < islandPositions.count; i++) { const x = islandPositions.getX(i), z = islandPositions.getZ(i), a = Math.atan2(z, x); const ripple = 1 + .035 * Math.sin(a * 7) + .019 * Math.cos(a * 11); islandPositions.setXYZ(i, x * ripple, islandPositions.getY(i), z * ripple); } islandGeo.computeVertexNormals();
  mesh(environment, islandGeo, rockMats[0], 0, -2.15, 0, 22, 4.1, 18, false);
  mesh(environment, islandGeo, rockMats[2], 0, -.5, 0, 22.1, .8, 18.1, false);
  mesh(environment, islandGeo, grass, 0, -.08, 0, 21.85, .35, 17.85, false);
  for (let i = 0; i < 64; i++) { const a = i * Math.PI * 2 / 64, radius = 1 + .027 * Math.sin(a * 7); const r = 1 + (i % 4) * .27; ball(environment, rockMats[i % 3], Math.cos(a) * 21.5 * radius, -1.8 - (i % 3) * .4, Math.sin(a) * 17.5 * radius, r, 1.3 + (i % 3) * .3, r * .8); }

  // Paths are the exact graph used by the walking residents.
  for (const [a, b] of WALK_EDGES) {
    const from = WALK_NODES[a], to = WALK_NODES[b], dx = to[0] - from[0], dz = to[1] - from[1];
    const p = box(environment, pathMat, (from[0] + to[0]) / 2, .15, (from[1] + to[1]) / 2, 1.65, .12, Math.hypot(dx, dz) + .8, false); p.rotation.y = Math.atan2(dx, dz);
    cylinder(environment, pathMat, from[0], .15, from[1], 1, .12, false);
  }
  const places = {} as Record<PlaceId, THREE.Group>;
  for (const id of Object.keys(WORLD_PLACES) as PlaceId[]) { const group = new THREE.Group(); group.userData.placeId = id; world.add(group); places[id] = group; }
  const castle = places.chapel;
  box(castle, stoneShade, 0, .2, -5.5, 10.8, .35, 9.5);
  // Central chapel keep with a raised nave, side aisles and a true solid roof.
  box(castle, stone, 0, 2.9, -5, 4, 5.6, 5.3); ridgeRoof(castle, jade, 0, 5.7, -5, 4.6, 2.9, 6);
  box(castle, stoneLight, -2.9, 1.6, -5.5, 1.7, 3, 4.8); ridgeRoof(castle, jadeLight, -2.9, 3.1, -5.5, 2.1, 1.4, 5.1);
  box(castle, stoneLight, 2.9, 1.6, -5.5, 1.7, 3, 4.8); ridgeRoof(castle, jadeLight, 2.9, 3.1, -5.5, 2.1, 1.4, 5.1);
  // Warm recessed arched doorway and rose window on the chapel facade.
  arch(castle, stoneShade, 0, .18, -2.31, 1.8, 3.4, .15); arch(castle, wood, 0, .18, -2.14, 1.35, 2.85, .035); box(castle, gold, 0, 1.1, -2.07, .07, 1.7, .05);
  const rose = mesh(castle, geo(new THREE.TorusGeometry(.61, .13, 6, 24)), stoneLight, 0, 4.65, -2.24); rose.rotation.x = 0;
  const glass = mesh(castle, geo(new THREE.CircleGeometry(.51, 20)), windowMat, 0, 4.65, -2.22); glass.rotation.x = 0;
  for (let i = 0; i < 8; i++) { const spoke = box(castle, gold, 0, 4.65, -2.2, .035, 1.05, .03); spoke.rotation.z = i * Math.PI / 4; }
  cross(castle, 0, 9.3, -4.8, 1.1);
  for (const x of [-4.8, 4.8]) for (const z of [-9.2, -1.7]) tower(castle, x, z, z < -5 ? 6.4 : 5, 1.05, z < -5 ? 3.8 : 2.6);
  battlement(castle, 0, -9.2, 9.6); battlement(castle, -4.8, -5.5, 7.5, Math.PI / 2); battlement(castle, 4.8, -5.5, 7.5, Math.PI / 2);
  battlement(castle, -3.3, -1.7, 3); battlement(castle, 3.3, -1.7, 3);
  // Gate arch has an actual opening: the inner path is cut out of the stone mesh.
  const gate = new THREE.Shape(); gate.moveTo(-1.9, 0); gate.lineTo(-1.25, 0); gate.lineTo(-1.25, 1.55); gate.absarc(0, 1.55, 1.25, Math.PI, 0, true); gate.lineTo(1.25, 0); gate.lineTo(1.9, 0); gate.lineTo(1.9, 3.8); gate.lineTo(-1.9, 3.8); gate.closePath();
  mesh(castle, geo(new THREE.ExtrudeGeometry(gate, { depth: .7, bevelEnabled: false, curveSegments: 16 })), stoneLight, 0, 0, -2.05);
  for (const x of [-1.5, -.5, .5, 1.5]) box(castle, stoneLight, x, 4.1, -1.7, .48, .6, .8);
  for (const x of [-1.45, 1.45]) windows(castle, x, -2.25, 2.6, 0, .6);
  for (const x of [-2, 2]) for (const z of [-4, -6.5]) windows(castle, x * 1.98, z, 1.15, x > 0 ? Math.PI / 2 : -Math.PI / 2, .75);
  for (let i = 0; i < 4; i++) box(castle, stoneLight, 0, .08 + i * .09, -.9 - i * .22, 2.8, .18, .35);

  // Open reading tower: octagonal galleries, books and a tall jade cap.
  const bible = places.bible; cylinder(bible, stoneShade, -13, .3, -6.5, 2.2, .6); cylinder(bible, stone, -13, 3.2, -6.5, 1.6, 6.2);
  for (const y of [1.7, 3.6, 5.7]) {
    cylinder(bible, stoneLight, -13, y, -6.5, 1.92, .22);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; cylinder(bible, gold, -13 + Math.sin(a) * 1.7, y + .65, -6.5 + Math.cos(a) * 1.7, .055, 1.25); }
  }
  for (const y of [.9, 2.8, 4.7]) for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) windows(bible, -13 + Math.sin(r) * 1.61, -6.5 + Math.cos(r) * 1.61, y, r, .7);
  mesh(bible, coneGeo, jadeLight, -13, 7.4, -6.5, 2.2, 2.6, 2.2); ball(bible, gold, -13, 8.8, -6.5, .16);
  const bookColors = [coral, jade, gold, windowMat];
  for (let i = 0; i < 9; i++) box(bible, bookColors[i % 4], -13.8 + i * .2, .8, -4.78, .13, .55 + (i % 3) * .1, .22);

  // Prayer garden: planted circle, stone colonnade and a real tiered fountain.
  const prayer = places.prayer; cylinder(prayer, pathMat, 14, .2, -7, 4, .18); cylinder(prayer, stoneShade, 14, .35, -7, 2.05, .35); cylinder(prayer, stoneLight, 14, .55, -7, 1.85, .3);
  const waterMat = mat(0x6dc4c1, .23); cylinder(prayer, waterMat, 14, .73, -7, 1.62, .06); cylinder(prayer, stoneLight, 14, 1.15, -7, .26, 1.15); cylinder(prayer, stoneLight, 14, 1.65, -7, .9, .18); cylinder(prayer, waterMat, 14, 1.76, -7, .72, .04); cylinder(prayer, stoneLight, 14, 2.05, -7, .13, .6); ball(prayer, gold, 14, 2.42, -7, .14);
  const streams: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const stream = cylinder(prayer, waterMat, 14 + Math.cos(a) * .68, 1.2, -7 + Math.sin(a) * .68, .035, 1.04, false); streams.push(stream); }
  for (let i = 0; i < 7; i++) { const a = Math.PI + i * Math.PI / 6; const x = 14 + Math.cos(a) * 3.2, z = -7 + Math.sin(a) * 3.2; cylinder(prayer, stoneLight, x, 1.25, z, .17, 2.5); ball(prayer, stoneLight, x, 2.55, z, .23); }

  // Three little homes gathered around the lane, each with its own roof and porch.
  function cottage(x: number, z: number, roofMat: THREE.Material, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); places.groups.add(g);
    box(g, stoneShade, 0, .2, 0, 3.3, .4, 2.9); box(g, stoneLight, 0, 1.3, 0, 3, 2.3, 2.6); ridgeRoof(g, roofMat, 0, 2.45, 0, 3.65, 1.55, 3.25);
    arch(g, wood, 0, .25, 1.31, .65, 1.55, .05); windows(g, -1, 1.32, .8, 0, .6); windows(g, 1, 1.32, .8, 0, .6);
    box(g, stoneShade, 1, 3.3, -.7, .45, 1.4, .5); box(g, coral, 1, 4.02, -.7, .58, .17, .61);
    for (const x of [-1, 1]) { box(g, wood, x, .5, 1.6, .8, .25, .4); for (let j = 0; j < 3; j++) ball(g, foliage[1], x + (j - 1) * .22, .72, 1.6, .21); }
  }
  cottage(-17, 5, gold); cottage(-16.9, 8.3, coral, .92); cottage(-11.5, 10.5, jadeLight);

  // Grace library: a generous arcade, tall windows, books and a copper roof.
  const library = places.grace; box(library, stoneShade, 15, .25, 1, 5.7, .5, 4.7); box(library, stone, 15, 2.2, 1, 5.2, 3.9, 4); ridgeRoof(library, coral, 15, 4.18, 1, 5.9, 1.7, 4.8);
  for (const x of [13.1, 14.35, 15.65, 16.9]) { windows(library, x, 3.02, 1.35, 0, 1); cylinder(library, stoneLight, x, 1.8, 3.55, .13, 3.5); }
  box(library, stoneLight, 15, 3.55, 3.55, 5.6, .22, .65); arch(library, wood, 15, .3, 3.12, .9, 1.7, .08);
  for (let i = 0; i < 10; i++) box(library, bookColors[i % 4], 13.2 + i * .23, .8, 3.7, .16, .5 + (i % 3) * .13, .22);
  // An open book over the portico is made of two angled page blocks.
  for (const side of [-1, 1]) { const page = box(library, stoneLight, 15 + side * .32, 4.2, 3.6, .65, .08, .7); page.rotation.z = side * .18; }

  // Community square: compass-rose paving and a ring of seats.
  const square = places.square; cylinder(square, stoneShade, 0, .2, 5.5, 3.75, .15, false); cylinder(square, stoneLight, 0, .29, 5.5, 3.5, .06, false); cylinder(square, pathMat, 0, .33, 5.5, 2.85, .04, false);
  const compassShape = new THREE.Shape(); compassShape.moveTo(0, -2.3); compassShape.lineTo(.35, -.35); compassShape.lineTo(2.3, 0); compassShape.lineTo(.35, .35); compassShape.lineTo(0, 2.3); compassShape.lineTo(-.35, .35); compassShape.lineTo(-2.3, 0); compassShape.lineTo(-.35, -.35); compassShape.closePath();
  const compass = mesh(square, geo(new THREE.ShapeGeometry(compassShape)), jadeLight, 0, .36, 5.5); compass.rotation.x = -Math.PI / 2;
  // Pavilion with an open six-column roof, lantern and picnic table.
  const pavilion = places.play; cylinder(pavilion, stoneShade, 9, .25, 9, 2.7, .35); cylinder(pavilion, stoneLight, 9, .48, 9, 2.4, .18);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; cylinder(pavilion, stoneLight, 9 + Math.sin(a) * 2.1, 1.85, 9 + Math.cos(a) * 2.1, .12, 2.8); }
  mesh(pavilion, coneGeo, coral, 9, 3.65, 9, 2.9, 1.75, 2.9); ball(pavilion, gold, 9, 4.6, 9, .12);
  cylinder(pavilion, wood, 9, 1, 9, .8, .12); cylinder(pavilion, wood, 9, .7, 9, .1, .6);

  // An arched entrance bridge, stair landings and slender balustrades.
  const bridge = new THREE.Group(); environment.add(bridge);
  for (let i = 0; i < 15; i++) { const z = 16.3 + i * .51; const y = -.08 + Math.sin(i / 14 * Math.PI) * .45; box(bridge, stoneLight, 0, y, z, 3, .36, .55); for (const x of [-1.4, 1.4]) { box(bridge, stone, x, y + .62, z, .16, 1.1, .16); if (i < 14) box(bridge, stoneLight, x, y + 1.2, z + .25, .22, .16, .6); } }
  for (const z of [17, 21.8]) for (const x of [-1.3, 1.3]) box(bridge, stoneShade, x, -1.6, z, .65, 3, 1.2);
  cylinder(bridge, rockMats[1], 0, -2.2, 24, 3.7, 2.7); cylinder(bridge, grass, 0, -.75, 24, 3.6, .25); cylinder(bridge, pathMat, 0, -.57, 24, 2.7, .12);

  const obstacleBounds: { kind: string; box: THREE.Box3 }[] = [];
  function captureObstacle(kind: string, objects: THREE.Object3D[]) {
    const bound = new THREE.Box3();
    for (const object of objects) { object.updateWorldMatrix(true, true); bound.union(new THREE.Box3().setFromObject(object)); }
    obstacleBounds.push({ kind, box: bound });
  }
  function tree(x: number, z: number, size = 1, index = 0) {
    const start = environment.children.length;
    cylinder(environment, wood, x, size * .8, z, .13 * size, 1.6 * size, false);
    ball(environment, foliage[index % foliage.length], x, 2.15 * size, z, 1.03 * size, 1.35 * size);
    ball(environment, foliage[(index + 1) % foliage.length], x + .42 * size, 1.95 * size, z + .17, .68 * size, .9 * size);
    captureObstacle(`tree at ${x},${z}`, environment.children.slice(start));
  }
  const treePositions = [[-20, 0], [-18, -4], [-18, -9], [-15, -12], [-10, -14], [-4, -14.7], [4, -14], [8, -14], [14, -12], [18, -8], [20, -2], [20, 3], [18.8, 9], [16, 11.7], [7, 15], [-6, 14], [-10, 13.5], [-18, 13], [-20, 7], [-7, -6], [7.2, -6], [-7, 8.5], [6, 3], [8.2, -3], [-11.5, -.4], [17.5, -11], [-3.5, 12.5], [4, 14.3]];
  treePositions.forEach(([x, z], i) => tree(x, z, .72 + (i % 4) * .14, i));
  // Slender cypresses frame the main gate without blocking the walking path.
  for (const x of [-6.4, 6.4]) for (const z of [-1, -8.5]) { cylinder(environment, wood, x, 1, z, .1, 2); mesh(environment, coneGeo, foliage[0], x, 2, z, .6, 3.8, .6); }
  function bench(parent: THREE.Group, x: number, z: number, rotation = 0) {
    const g = new THREE.Group(); g.position.set(x, .25, z); g.rotation.y = rotation; parent.add(g);
    for (const x of [-.65, .65]) { box(g, dark, x, .25, 0, .1, .5, .6); box(g, dark, x, .65, -.24, .1, 1.2, .1); }
    for (const z of [-.22, 0, .22]) box(g, wood, 0, .54, z, 1.7, .12, .14);
    for (const y of [.83, 1.07]) box(g, wood, 0, y, -.25, 1.7, .14, .09);
    captureObstacle(`bench at ${x},${z}`, [g]);
  }
  bench(environment, -3.7, 6, Math.PI / 2); bench(environment, 2.5, 8.4, -Math.PI / 2); bench(environment, 11, -6, -Math.PI / 2); bench(environment, 16.8, -7, Math.PI / 2); bench(environment, -9, 6); bench(environment, 5.5, 9.9, -.5);
  const glowMat = mat(0xffe2a0); const lamps: THREE.Mesh[] = [];
  for (const [x, z] of [[-1.7, 14], [1.7, 14], [-4.2, 2], [4.2, 2], [-9.3, 2.9], [10.5, 5.5], [-12.5, 8.2], [14.5, 8.3], [7, 13.5], [-6.8, -10.8]]) {
    const start = environment.children.length;
    cylinder(environment, dark, x, 1.35, z, .06, 2.7); cylinder(environment, dark, x, .22, z, .2, .4);
    lamps.push(box(environment, glowMat, x, 2.72, z, .33, .5, .33)); mesh(environment, coneGeo, jade, x, 3.1, z, .32, .3, .32);
    captureObstacle(`lamp at ${x},${z}`, environment.children.slice(start));
  }
  const flowerMats = [mat(0xffcc67), mat(0xe99b90), mat(0xf4f2d2)];
  for (let i = 0; i < 125; i++) {
    const a = i * 2.39996, ring = 1 + ((i * 19) % 29) / 29;
    let x: number, z: number;
    if (i < 40) { x = 14 + Math.cos(a) * 3.4; z = -7 + Math.sin(a) * 3.4; }
    else if (i < 75) { x = -6.4 + Math.sin(a) * .5; z = -9 + (i - 40) * .24; }
    else if (i < 105) { x = 6.4 + Math.sin(a) * .5; z = -9 + (i - 75) * .26; }
    else { x = Math.cos(a) * (19 + ring); z = Math.sin(a) * 15.4; }
    cylinder(environment, foliage[1], x, .29, z, .035, .35, false); ball(environment, flowerMats[i % 3], x, .5, z, .15, .12);
  }
  // Low hedges and stone bollards make each route feel inhabited.
  for (let i = 0; i < 12; i++) { ball(environment, foliage[1], -4.9 + i * .88, .45, -10.6, .43, .45); }
  for (let i = 0; i < 18; i++) { const a = i * Math.PI / 9; if (Math.sin(a) > .8) continue; cylinder(environment, stoneLight, Math.cos(a) * 20.8, .5, Math.sin(a) * 16.7, .12, .8); }

  // Small outlying reefs with their own miniature trees.
  for (const [x, z, scale] of [[-30, -9, 1.8], [28, -19, 2.2], [-25, 22, 1.2]]) {
    ball(environment, rockMats[1], x, -3.3, z, scale * 2, scale, scale * 1.5); ball(environment, grass, x, -2.8, z, scale * 1.6, scale * .5, scale * 1.2);
    cylinder(environment, wood, x, -1.7, z, .12, 1.8); ball(environment, foliage[1], x, -.5, z, 1, 1.3);
  }

  const animatedFlags: THREE.Mesh[] = [];
  for (const [x, y, z] of [[-4.8, 8, -1.7], [4.8, 8, -1.7], [-13, 9.3, -6.5], [-1.9, 3, 15.5], [1.9, 3, 15.5]]) {
    cylinder(world, gold, x, y - .6, z, .035, 2.4);
    const flag = mesh(world, geo(new THREE.PlaneGeometry(.95, .52, 6, 1)), coral, x + .46, y, z); (flag.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; animatedFlags.push(flag);
  }
  // Two little sailboats, rendered as solid hulls and a curved triangular sail.
  const boats: THREE.Group[] = [];
  for (const [x, z, rotation] of [[-23, 15, .4], [25, -9, -1.1]]) {
    const boat = new THREE.Group(); boat.position.set(x, -3.1, z); boat.rotation.y = rotation; world.add(boat); boats.push(boat);
    const hull = ball(boat, wood, 0, 0, 0, .7, .26, 1.7); hull.rotation.z = .04;
    cylinder(boat, wood, 0, 1.4, 0, .045, 2.9);
    const shape = new THREE.Shape(); shape.moveTo(.1, 0); shape.lineTo(.1, 2.4); shape.quadraticCurveTo(1.4, 1, .1, 0);
    const sailMaterial = mat(0xfff5d7); sailMaterial.side = THREE.DoubleSide; mesh(boat, geo(new THREE.ShapeGeometry(shape, 8)), sailMaterial, 0, .35, 0);
  }

  const clothes = [mat(0xd88065), mat(0xe3b854), mat(0x3d8986), mat(0x677cac), mat(0xf0e6cc), mat(0x8b79a5)];
  const skins = [mat(0xdca582), mat(0xa97455), mat(0xf0c6a1), mat(0xc58c68)]; const hair = [mat(0x49392f), mat(0x8c603b), mat(0xddd5bd)]; const trousers = [mat(0x435865), mat(0x756957), mat(0x465c51)];
  const walkers: { group: THREE.Group; state: WalkerState; arms: THREE.Group[]; legs: THREE.Group[]; phase: number }[] = [];
  for (let i = 0; i < 16; i++) {
    const person = new THREE.Group(); person.name = `resident-${i + 1}`; world.add(person);
    const outfit = clothes[i % clothes.length], skin = skins[i % skins.length], pants = trousers[i % trousers.length];
    cylinder(person, outfit, 0, .88, 0, .21, .55); ball(person, skin, 0, 1.36, 0, .185, .21); ball(person, hair[i % 3], 0, 1.48, -.025, .19, .12, .18);
    // Tiny noses show the direction residents are looking while turning.
    ball(person, skin, 0, 1.35, .17, .06, .06, .055);
    const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * .27, 1.08, 0); person.add(arm); arms.push(arm);
      cylinder(arm, outfit, 0, -.13, 0, .075, .27); cylinder(arm, skin, 0, -.34, 0, .057, .22); ball(arm, skin, 0, -.47, 0, .065);
      const leg = new THREE.Group(); leg.position.set(side * .105, .64, 0); person.add(leg); legs.push(leg);
      cylinder(leg, pants, 0, -.25, 0, .08, .5); box(leg, dark, 0, -.51, .055, .16, .1, .27);
    }
    if (i % 4 === 0) { box(person, coral, 0, .87, -.24, .3, .35, .14); }
    if (i % 5 === 0) { cylinder(person, gold, 0, 1.58, 0, .27, .055); }
    const edge = WALK_EDGES[i % WALK_EDGES.length];
    const state = { from: edge[0] as number, to: edge[1] as number, progress: ((i * 37) % 100) / 100, speed: .62 + (i % 4) * .09, seed: i + 11 };
    const position = advanceWalker(state, 0); person.position.set(position.x, Math.hypot(position.x, position.z - 5.5) < 3.5 ? .31 : .16, position.z); person.rotation.y = position.angle; person.scale.setScalar(.85 + (i % 3) * .07);
    walkers.push({ group: person, state, arms, legs, phase: i * .8 });
  }

  for (const place of Object.values(places)) batch(place); batch(environment);
  const seaGeometry = geo(new THREE.PlaneGeometry(220, 220, 64, 64));
  const seaMaterial = new THREE.MeshStandardMaterial({ color: 0x62bfb9, roughness: .36, metalness: .08, flatShading: true }); materials.add(seaMaterial);
  const sea = new THREE.Mesh(seaGeometry, seaMaterial); sea.rotation.x = -Math.PI / 2; sea.position.y = -3.5; sea.receiveShadow = true; world.add(sea);
  // Foam is a 3D ring around the cliff, rather than an image or a painted backdrop.
  const foamMaterial = mat(0xc4e8d7); const foam = mesh(world, geo(new THREE.TorusGeometry(1, .035, 3, 100)), foamMaterial, 0, -3.38, 0, 23.2, 18.7, 1, false); foam.rotation.x = -Math.PI / 2;
  const originalSeaPositions = Float32Array.from(seaGeometry.attributes.position.array);
  let elapsed = 0;
  function update(delta: number) {
    const dt = Math.max(0, Math.min(.05, delta)); elapsed += dt;
    for (const walker of walkers) {
      const position = advanceWalker(walker.state, dt); walker.group.position.set(position.x, (Math.hypot(position.x, position.z - 5.5) < 3.5 ? .31 : .16) + Math.abs(Math.sin(elapsed * 7 + walker.phase)) * .025, position.z); walker.group.rotation.y = position.angle;
      walker.arms.forEach((arm, i) => { arm.rotation.x = Math.sin(elapsed * 6.5 + walker.phase + i * Math.PI) * .45; });
      walker.legs.forEach((leg, i) => { leg.rotation.x = -Math.sin(elapsed * 6.5 + walker.phase + i * Math.PI) * .42; });
    }
    boats.forEach((boat, i) => { boat.position.y = -3.1 + Math.sin(elapsed * 1.5 + i * 2) * .1; boat.rotation.z = Math.sin(elapsed + i) * .045; });
    animatedFlags.forEach((flag, i) => { const position = flag.geometry.attributes.position; for (let j = 0; j < position.count; j++) { const x = position.getX(j); position.setZ(j, Math.sin(x * 5 + elapsed * 3 + i) * .08 * (x + .5)); } position.needsUpdate = true; });
    const positions = seaGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) { const x = originalSeaPositions[i * 3], y = originalSeaPositions[i * 3 + 1]; positions.setZ(i, Math.sin(x * .45 + elapsed * .75) * .07 + Math.cos(y * .5 + elapsed) * .05); } positions.needsUpdate = true;
    streams.forEach((stream, i) => { stream.scale.x = stream.scale.z = .03 + Math.sin(elapsed * 5 + i) * .004; });
  }
  function night(value: boolean) { glowMat.emissive.setHex(value ? 0xffc563 : 0x000000); glowMat.emissiveIntensity = value ? .9 : 0; seaMaterial.color.setHex(value ? 0x255d70 : 0x62bfb9); }
  function dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); }
  return { group: world, places, walkers, update, night, dispose, residentCount: walkers.length, obstacleBounds };
}
