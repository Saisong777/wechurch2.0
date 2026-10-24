import {expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {createAmbientLife} from './ambientLife';
import {WALK_EDGES,WALK_NODES} from '@shared/castleNavigation';
import {BUILDING_FOOTPRINTS,buildCastleWorld} from './world';
it('creates articulated residents and four recognisable mesh species outside real presence',()=>{
 const life=createAmbientLife();expect(life.actors.filter(a=>a.kind==='resident')).toHaveLength(7);expect(life.actors.filter(a=>a.kind!=='resident')).toHaveLength(6);expect(new Set(life.actors.filter(a=>a.kind!=='resident').map(a=>a.kind))).toEqual(new Set(['cat','dog','rabbit','sheep']));
 for(const actor of life.actors){expect(actor.legs).toHaveLength(actor.kind==='resident'?2:4);expect(actor.arms).toHaveLength(actor.kind==='resident'?2:0);if(actor.kind!=='resident'){expect(actor.ears).toHaveLength(2);expect(actor.tail).toBeTruthy();}let meshes=0;actor.group.traverse(value=>{if(value instanceof THREE.Mesh){meshes++;expect((value.material as THREE.MeshStandardMaterial).map).toBeNull();expect(value.userData.ambientActor).toBe(true);}});expect(meshes).toBeGreaterThan(6);}
 const world=buildCastleWorld();expect(world.residentCount).toBe(0);expect(world.walkers).toEqual([]);world.setPresence([],1000,0);expect(world.ambient.actors).toHaveLength(13);expect(world.ambient.group.parent).toBe(world.group);world.dispose();life.dispose();
});
it('uses only connected safe walk edges and keeps actual actor bodies clear of buildings and environment',()=>{
 const world=buildCastleWorld(),errors=new Set<string>();
 for(const actor of world.ambient.actors){
  for(let i=0;i<actor.route.length;i++){
   const from=actor.route[i],to=actor.route[(i+1)%actor.route.length];expect(WALK_EDGES.some(([a,b])=>a===from&&b===to||a===to&&b===from)).toBe(true);
   const a=WALK_NODES[from],b=WALK_NODES[to];
   for(let n=0;n<=50;n++){
    const t=n/50;actor.group.position.set(a[0]+(b[0]-a[0])*t,.21,a[1]+(b[1]-a[1])*t);actor.group.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);for(const swing of [-.4,0,.4]){actor.legs.forEach((leg,i)=>{leg.rotation.x=swing*(i%2?1:-1);});actor.arms.forEach((arm,i)=>{arm.rotation.x=swing*(i?1:-1);});actor.ears.forEach((ear,i)=>{ear.rotation.x=swing*.17*(i?1:-1);});if(actor.tail)actor.tail.rotation.z=swing*.5;actor.group.updateWorldMatrix(true,true);const body=new THREE.Box3().setFromObject(actor.group);
    for(const obstacle of BUILDING_FOOTPRINTS)if(body.max.x>obstacle.x-obstacle.halfX&&body.min.x<obstacle.x+obstacle.halfX&&body.max.z>obstacle.z-obstacle.halfZ&&body.min.z<obstacle.z+obstacle.halfZ)errors.add(`${actor.kind} ${from}-${to}: ${obstacle.id}`);
    for(const obstacle of world.obstacleBounds)if(body.intersectsBox(obstacle.box))errors.add(`${actor.kind} ${from}-${to}: ${obstacle.kind}`);}
   }
  }
 }
 expect([...errors]).toEqual([]);world.dispose();
});
it('moves along paths with distinct stops and finite clamped animation time, freezing every transform without updates',()=>{
 const life=createAmbientLife(),moving=new Set<number>(),stopped=new Set<number>(),legsMoved=new Set<string>();
 for(let n=0;n<1500;n++){life.update(.05);life.actors.forEach((actor,i)=>{(actor.moving?moving:stopped).add(i);if(actor.legs.some(leg=>Math.abs(leg.rotation.x)>.1))legsMoved.add(actor.kind);});}
 expect(moving.size).toBe(13);expect(stopped.size).toBe(13);expect(legsMoved.size).toBe(5);
 const walker=life.actors[0];let wasMoving=walker.moving,foundStop=false;for(let n=0;n<1000;n++){life.update(.05);if(wasMoving&&!walker.moving){foundStop=true;const point=walker.group.position.clone();life.update(.05);life.update(.05);expect(walker.group.position).toEqual(point);expect(walker.legs.every(leg=>leg.rotation.x===0)).toBe(true);break;}wasMoving=walker.moving;}expect(foundStop).toBe(true);
 const transforms=()=>{life.group.updateMatrixWorld(true);const values:number[][]=[];life.group.traverse(object=>values.push(object.matrix.toArray()));return values;};const still=transforms(),time=life.snapshot().elapsed;
 life.update(0);life.update(NaN);life.update(-1);expect(transforms()).toEqual(still);expect(life.snapshot().elapsed).toBe(time);life.update(999);expect(life.snapshot().elapsed).toBeCloseTo(time+.05);life.dispose();
});
it('tags real interactive meshes and disposes owned resources once',()=>{
 const life=createAmbientLife(),geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();let meshes=0;
 life.group.traverse(object=>{if(object instanceof THREE.Mesh){meshes++;expect(object.raycast).toBe(THREE.Mesh.prototype.raycast);expect(typeof object.userData.ambientId).toBe('string');geometries.add(object.geometry);materials.add(object.material as THREE.Material);}});
 expect(meshes).toBeLessThan(220);const spies=[...geometries,...materials].map(resource=>vi.spyOn(resource,'dispose'));life.dispose();life.dispose();for(const spy of spies)expect(spy).toHaveBeenCalledOnce();vi.restoreAllMocks();
});

it('hits actual ambient geometry before the original ground while trees still occlude',()=>{
 const world=buildCastleWorld();world.group.updateMatrixWorld(true);const character=world.ambient.actors[0].group.position;const ray=new THREE.Raycaster(new THREE.Vector3(character.x,20,character.z),new THREE.Vector3(0,-1,0));const hits=ray.intersectObject(world.group,true);expect(hits.length).toBeGreaterThan(0);expect(hits[0].object.userData.ambientId).toBe('ambient-resident-1');expect(hits.some(hit=>hit.object.userData.walkSurface)).toBe(true);
 ray.set(new THREE.Vector3(-20,20,0),new THREE.Vector3(0,-1,0));const tree=ray.intersectObject(world.group,true)[0];expect(tree).toBeTruthy();expect(tree.object.userData.walkSurface).not.toBe(true);world.dispose();
});


it('stops each greeted actor on its own route clock, shows species reactions and resumes without catching up',()=>{
 const life=createAmbientLife();for(let n=0;n<20;n++)life.update(.05);
 for(const actor of life.actors){
  const id=actor.group.name,time=actor.elapsed,point=actor.group.position.clone();expect(life.interact(id,'hello')).toBe(true);expect(actor.interaction?.elapsed).toBe(0);
  const initial=actor.group.children.map(child=>child.rotation.toArray());for(let n=0;n<8;n++)life.update(.05);
  expect(actor.elapsed).toBe(time);expect(actor.moving).toBe(false);expect(actor.group.position.x).toBe(point.x);expect(actor.group.position.z).toBe(point.z);
  const differentJoints=JSON.stringify(actor.group.children.map(child=>child.rotation.toArray()))!==JSON.stringify(initial);expect(differentJoints||actor.kind==='rabbit'||actor.kind==='sheep').toBe(true);
  let before=actor.group.position.clone();for(let n=0;n<62;n++){life.update(.05);const step=Math.hypot(actor.group.position.x-before.x,actor.group.position.z-before.z);expect(step).toBeLessThan(.06);before=actor.group.position.clone();}
  expect(actor.interaction).toBeUndefined();expect(actor.elapsed).toBeLessThan(time+1);expect(actor.elapsed).toBeGreaterThan(time);
 }
 expect(life.interact('forged-real-avatar','hello')).toBe(false);life.dispose();
});
it('keeps a static response with every transform and interaction clock frozen until update, including repeated actions',()=>{
 const life=createAmbientLife();for(const actor of life.actors){expect(life.interact(actor.group.name,'affection',true)).toBe(true);}
 const matrices=()=>{life.group.updateMatrixWorld(true);const result:number[][]=[];life.group.traverse(value=>result.push(value.matrix.toArray()));return result;};const before=matrices(),times=life.actors.map(actor=>actor.interaction?.elapsed);
 life.snapshot();life.update(0);life.update(NaN);expect(matrices()).toEqual(before);expect(life.actors.map(actor=>actor.interaction?.elapsed)).toEqual(times);
 const resident=life.actors[0];expect(resident.arms.every(arm=>arm.rotation.x< -1)).toBe(true);life.interact(resident.group.name,'hello',true);expect(resident.arms[0].rotation.x).toBe(0);expect(resident.arms[1].rotation.x).toBeLessThan(-1);life.dispose();
});


it('keeps the actual greeting and affection poses clear along every actor route heading and endpoint',()=>{
 const world=buildCastleWorld(),errors=new Set<string>();
 for(const actor of world.ambient.actors)for(const action of ['hello','affection'] as const){
  world.ambient.interact(actor.group.name,action);
  for(let frame=0;frame<56;frame++){
   world.ambient.update(.05);if(frame%7!==0&&frame!==55)continue;
   for(let edge=0;edge<actor.route.length;edge++){
    const a=WALK_NODES[actor.route[edge]],b=WALK_NODES[actor.route[(edge+1)%actor.route.length]];
    for(let n=0;n<=12;n++){
     const t=n/12;actor.group.position.set(a[0]+(b[0]-a[0])*t,.23,a[1]+(b[1]-a[1])*t);actor.group.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);actor.group.updateWorldMatrix(true,true);const body=new THREE.Box3().setFromObject(actor.group);
     for(const obstacle of world.obstacleBounds)if(body.intersectsBox(obstacle.box))errors.add(`${actor.kind} ${action} ${actor.route[edge]}-${actor.route[(edge+1)%actor.route.length]}: ${obstacle.kind}`);
     for(const obstacle of BUILDING_FOOTPRINTS)if(body.max.x>obstacle.x-obstacle.halfX&&body.min.x<obstacle.x+obstacle.halfX&&body.max.z>obstacle.z-obstacle.halfZ&&body.min.z<obstacle.z+obstacle.halfZ)errors.add(`${actor.kind} ${action}: ${obstacle.id}`);
    }
   }
  }
 }
 expect([...errors]).toEqual([]);world.dispose();
});
