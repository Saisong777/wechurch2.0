import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WALK_NODES} from '@shared/castleNavigation';

type Species='cat'|'dog'|'rabbit'|'sheep';
type Actor={group:THREE.Group;kind:'resident'|Species;route:readonly number[];speed:number;phase:number;legs:THREE.Group[];arms:THREE.Group[];ears:THREE.Group[];tail?:THREE.Group;elapsed:number;moving:boolean};
// Consecutive points are existing safe graph edges, including the closing edge.
// Different starting phases and occasional node stops keep this a small neighbourhood, not a parade.
// Wider silhouettes deliberately avoid the narrow bench/cottage/library turns (2–4, 5–6, 11–12).
const promenade=[0,1,2,3,2,12,15,14,1] as const;
const village=[4,5,7,5] as const;
const garden=[1,2,12,13,12,15,14] as const;
const north=[7,8,9,10,11,10,9,8] as const;
const routes=[promenade,village,garden,north];
const surface=(x:number,z:number)=>Math.hypot(x,z-5.5)<3.5?.35:.21;

export function createAmbientLife(){
 const group=new THREE.Group();group.name='ambient-life';group.userData.ambientActor=true;
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Map<number,THREE.MeshStandardMaterial>();
 const geometry=<T extends THREE.BufferGeometry>(value:T)=>{geometries.add(value);return value;};
 const cube=geometry(new THREE.BoxGeometry(1,1,1)),round=geometry(new THREE.IcosahedronGeometry(1,1)),cylinder=geometry(new THREE.CylinderGeometry(1,1,1,8)),cone=geometry(new THREE.ConeGeometry(1,1,4));
 const material=(color:number)=>{let value=materials.get(color);if(!value){value=new THREE.MeshStandardMaterial({color,roughness:.88,flatShading:true});materials.set(color,value);}return value;};
 function mesh(parent:THREE.Group,shape:THREE.BufferGeometry,color:number,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){const value=new THREE.Mesh(shape,material(color));value.position.set(x,y,z);value.scale.set(sx,sy,sz);value.castShadow=true;value.receiveShadow=true;parent.add(value);return value;}
 const ball=(parent:THREE.Group,color:number,x:number,y:number,z:number,sx:number,sy=sx,sz=sx)=>mesh(parent,round,color,x,y,z,sx,sy,sz);
 const box=(parent:THREE.Group,color:number,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>mesh(parent,cube,color,x,y,z,sx,sy,sz);
 const limb=(parent:THREE.Group,x:number,y:number,z:number)=>{const value=new THREE.Group();value.position.set(x,y,z);parent.add(value);return value;};
 // Merge static pieces within each joint by material. Shared primitive resources remain bounded;
 // only the articulated joints need their own draw calls.
 function batch(parent:THREE.Group){
  parent.updateMatrixWorld(true);const inverse=parent.matrixWorld.clone().invert(),batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  for(const child of [...parent.children])if(child instanceof THREE.Mesh){const copy=child.geometry.clone();copy.applyMatrix4(inverse.clone().multiply(child.matrixWorld));copy.deleteAttribute('uv');const flat=copy.index?copy.toNonIndexed():copy;if(flat!==copy)copy.dispose();const list=batches.get(child.material as THREE.Material)||[];list.push(flat);batches.set(child.material as THREE.Material,list);child.removeFromParent();}
  for(const [color,parts] of batches){const merged=mergeGeometries(parts,false);parts.forEach(part=>part.dispose());if(merged){const value=new THREE.Mesh(geometry(merged),color);value.castShadow=true;value.receiveShadow=true;parent.add(value);}}
 }
 const actors:Actor[]=[];
 const palette=[0x4c9584,0xe6bc63,0xd9846b,0x748fb7,0xa590b7,0xffedcb,0x659c80],skin=[0xe6b394,0xa77255,0xf1c9a3,0xc38b67],hair=[0x4a3b32,0x866044,0xd6c6a6];
 for(let i=0;i<7;i++){
  const person=new THREE.Group();person.name=`ambient-resident-${i+1}`;group.add(person);
  const coat=palette[i],face=skin[i%skin.length],dark=0x425d58;
  mesh(person,cylinder,coat,0,.9,0,.21,.56,.21);ball(person,face,0,1.36,0,.205,.235,.2);ball(person,hair[i%3],0,1.49,-.035,.214,.13,.19);
  ball(person,face,0,1.34,.195,.055,.06,.05);
  for(const x of [-.075,.075])ball(person,0x35443d,x,1.395,.185,.019,.022,.018);
  const arms:THREE.Group[]=[],legs:THREE.Group[]=[];
  for(const side of [-1,1]){
   const arm=limb(person,side*.275,1.08,0);mesh(arm,cylinder,coat,0,-.14,0,.075,.29,.075);ball(arm,face,0,-.38,0,.065,.13,.065);batch(arm);arms.push(arm);
   const leg=limb(person,side*.105,.61,0);mesh(leg,cylinder,dark,0,-.22,0,.078,.44,.078);box(leg,0x48514a,0,-.52,.045,.16,.16,.24);batch(leg);legs.push(leg);
  }
  if(i===1||i===5){mesh(person,cylinder,0xd9b76d,0,1.565,0,.29,.045,.29);mesh(person,cylinder,0xd9b76d,0,1.62,-.015,.185,.13,.185);}
  if(i===0||i===3)box(person,0xb76c53,0,.91,-.24,.29,.33,.13);
  if(i===2||i===6){box(person,0xf6ecd2,0,1.155,.02,.38,.08,.38);box(person,0xf6ecd2,.13,1.02,.21,.09,.25,.04);}
  batch(person);
  const actor:Actor={group:person,kind:'resident',route:routes[i%routes.length],speed:.68+i*.045,phase:4+i*11,legs,arms,ears:[],elapsed:0,moving:false};actors.push(actor);
 }
 const species:Species[]=['cat','dog','rabbit','sheep','cat','dog'];
 species.forEach((kind,i)=>{
  const animal=new THREE.Group();animal.name=`ambient-${kind}-${i+1}`;group.add(animal);
  const fur=kind==='cat'?(i===0?0xdca55e:0x728b8b):kind==='dog'?(i===1?0xc99562:0xf0dbb2):0xf7edda;
  const dark=0x42504b,pink=0xd99c97,legs:THREE.Group[]=[],ears:THREE.Group[]=[];
  // Deliberately oversize heads and ears make the species readable in the miniature mobile view.
  ball(animal,fur,0,.58,-.08,.255,.25,.35);ball(animal,kind==='sheep'?dark:fur,0,.82,.36,.235,.245,.23);
  ball(animal,kind==='dog'?0xf6e7cb:fur,0,.73,.56,.15,.11,.15);ball(animal,kind==='rabbit'?pink:dark,0,.765,.68,.042,.03,.035);
  for(const x of [-.088,.088]){ball(animal,dark,x,.88,.565,.028,.034,.023);ball(animal,0xfffdf0,x-.008,.892,.584,.009);}
  for(const x of [-.16,.16])for(const z of [-.28,.2]){
   const leg=limb(animal,x,.34,z);mesh(leg,cylinder,kind==='sheep'?dark:fur,0,-.12,0,.055,.24,.055);ball(leg,kind==='sheep'?dark:fur,0,-.29,.035,.075,.05,.11);batch(leg);legs.push(leg);
  }
  for(const side of [-1,1]){
   const ear=limb(animal,side*.17,kind==='rabbit'?.99:kind==='cat'?1.0:.93,.32);
   if(kind==='cat'){mesh(ear,cone,fur,0,.105,0,.115,.26,.08);mesh(ear,cone,pink,0,.115,.065,.06,.15,.012);}
   else if(kind==='rabbit'){ball(ear,fur,0,.23,0,.08,.29,.06);ball(ear,pink,0,.23,.047,.041,.21,.02);ear.rotation.z=side*-.12;}
   else {ball(ear,kind==='sheep'?dark:0x936d4f,side*.055,kind==='dog'?-.1:0,0,.08,kind==='dog'?.21:.075,.13);ear.rotation.z=side*.35;}
   batch(ear);ears.push(ear);
  }
  const tail=limb(animal,0,.64,-.42);
  if(kind==='cat'){mesh(tail,cylinder,fur,0,.18,-.06,.048,.4,.048).rotation.x=-.3;ball(tail,fur,0,.37,-.12,.06);}
  else if(kind==='dog'){const value=mesh(tail,cone,fur,0,.1,-.13,.1,.36,.1);value.rotation.x=-.8;}
  else ball(tail,fur,0,.025,-.04,kind==='rabbit'?.13:.1);
  batch(tail);
  if(kind==='sheep')for(let n=0;n<8;n++){const a=n*Math.PI/4;ball(animal,fur,Math.cos(a)*.17,.65+(n%2)*.1,-.1+Math.sin(a)*.22,.17,.18,.2);}
  if(kind==='dog')mesh(animal,cylinder,0x7baa9a,0,.68,.35,.18,.07,.18);
  if(kind==='cat'&&i===0)for(const z of [-.27,-.04])box(animal,0xaf7949,0,.775,z,.34,.045,.055);
  batch(animal);
  actors.push({group:animal,kind,route:routes[[0,2,1,0,1,2][i]],speed:kind==='rabbit'?.82:kind==='sheep'?.5:.68,phase:8+i*13,legs,arms:[],ears,tail,elapsed:0,moving:false});
 });
 // Decorative bodies never steal a building/ground tap. Terrain and trees still occlude normally.
 group.traverse(object=>{object.userData.ambientActor=true;if(object instanceof THREE.Mesh)object.raycast=()=>{};});
 let elapsed=0,disposed=false;
 function pose(actor:Actor,time:number){
  const route=actor.route,wait=actor.kind==='resident'?1.8:actor.kind==='rabbit'?2.4:3.1;
  let cycle=0;for(let n=0;n<route.length;n++){const a=WALK_NODES[route[n]],b=WALK_NODES[route[(n+1)%route.length]];cycle+=Math.hypot(b[0]-a[0],b[1]-a[1])/actor.speed+wait;}
  let t=(time+actor.phase)%cycle;actor.moving=false;
  for(let n=0;n<route.length;n++){
   const a=WALK_NODES[route[n]],b=WALK_NODES[route[(n+1)%route.length]],dx=b[0]-a[0],dz=b[1]-a[1],duration=Math.hypot(dx,dz)/actor.speed;
   if(t<=wait+duration){const progress=Math.min(1,Math.max(0,(t-wait)/duration));actor.moving=t>wait&&progress<1;const x=a[0]+dx*progress,z=a[1]+dz*progress;actor.group.position.set(x,surface(x,z),z);actor.group.rotation.y=Math.atan2(dx,dz);break;}t-=wait+duration;
  }
  const gait=actor.moving?Math.sin((time+actor.phase)*7):0;
  actor.legs.forEach((leg,n)=>{leg.rotation.x=gait*(actor.kind==='resident'?(n?.38:-.38):((n===0||n===3)?.32:-.32));});
  actor.arms.forEach((arm,n)=>{arm.rotation.x=gait*(n?-.38:.38);});
  actor.ears.forEach((ear,n)=>{ear.rotation.x=actor.moving?Math.sin((time+actor.phase)*5+n)*.065:0;});
  if(actor.tail)actor.tail.rotation.z=Math.sin((time+actor.phase)*3)*(actor.moving?.17:.07);
  actor.group.position.y+=actor.moving?Math.abs(gait)*(actor.kind==='rabbit'?.055:.015):0;
  actor.elapsed=time;
 }
 for(const actor of actors)pose(actor,0);
 function update(delta:number){if(disposed||!Number.isFinite(delta)||delta<=0)return;elapsed+=Math.min(.05,delta);for(const actor of actors)pose(actor,elapsed);}
 function snapshot(){const sample=(actor:Actor)=>({kind:actor.kind,position:actor.group.position.toArray().map(v=>Number(v.toFixed(4))),legs:actor.legs.map(leg=>Number(leg.rotation.x.toFixed(4))),moving:actor.moving});return {residents:7,animals:6,elapsed:Number(elapsed.toFixed(4)),resident:sample(actors[0]),animal:sample(actors[7])};}
 function dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());}
 return {group,actors,update,snapshot,dispose};
}
